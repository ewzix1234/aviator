// tools/detourer.swift — usage: swift tools/detourer.swift entree.png sortie.png
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
let rep = NSBitmapImageRep(cgImage: cg)
try rep.representation(using: .png, properties: [:])!.write(to: sortie)
print("ecrit:", sortie.path)
