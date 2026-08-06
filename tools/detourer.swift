// tools/detourer.swift — détoure le sujet d'une image et recadre sur son contenu.
// usage: swift tools/detourer.swift entree.png sortie.png
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count == 3 else { fputs("usage: detourer.swift entree sortie\n", stderr); exit(1) }
let entree = URL(fileURLWithPath: args[1])
let sortie = URL(fileURLWithPath: args[2])

guard let ciImage = CIImage(contentsOf: entree) else { fputs("lecture impossible\n", stderr); exit(1) }
let requete = VNGenerateForegroundInstanceMaskRequest()
let gestionnaire = VNImageRequestHandler(ciImage: ciImage)
try gestionnaire.perform([requete])
guard let resultat = requete.results?.first else { fputs("aucun sujet detecte\n", stderr); exit(1) }
let masque = try resultat.generateScaledMaskForImage(forInstances: resultat.allInstances, from: gestionnaire)

let filtre = CIFilter(name: "CIBlendWithMask")!
filtre.setValue(ciImage, forKey: kCIInputImageKey)
filtre.setValue(CIImage(color: .clear).cropped(to: ciImage.extent), forKey: kCIInputBackgroundImageKey)
filtre.setValue(CIImage(cvPixelBuffer: masque), forKey: kCIInputMaskImageKey)

let contexte = CIContext()
guard let cg = contexte.createCGImage(filtre.outputImage!, from: ciImage.extent) else { exit(1) }

// Recadrage sur les pixels non transparents (supprime les grandes marges vides)
let l = cg.width, h = cg.height
var pixels = [UInt8](repeating: 0, count: l * h * 4)
let espace = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(data: &pixels, width: l, height: h, bitsPerComponent: 8, bytesPerRow: l * 4,
                          space: espace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: l, height: h))

var minX = l, minY = h, maxX = -1, maxY = -1
for y in 0..<h {
  for x in 0..<l where pixels[(y * l + x) * 4 + 3] > 12 {
    if x < minX { minX = x }; if x > maxX { maxX = x }
    if y < minY { minY = y }; if y > maxY { maxY = y }
  }
}
guard maxX >= minX, maxY >= minY else { fputs("image vide apres detourage\n", stderr); exit(1) }
let marge = 4
let rect = CGRect(x: max(0, minX - marge), y: max(0, minY - marge),
                  width: min(l - max(0, minX - marge), maxX - minX + 1 + marge * 2),
                  height: min(h - max(0, minY - marge), maxY - minY + 1 + marge * 2))
guard let recadre = cg.cropping(to: rect) else { exit(1) }

let rep = NSBitmapImageRep(cgImage: recadre)
try rep.representation(using: .png, properties: [:])!.write(to: sortie)
print("ecrit:", sortie.lastPathComponent, "(\(Int(rect.width))x\(Int(rect.height)))")
