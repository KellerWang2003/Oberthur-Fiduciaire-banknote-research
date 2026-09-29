// Renders every page of the UV-ink PDFs to JPEGs for the touch-heatmap extraction tool.
// Usage: swift scripts/render-uv.swift "<folder with PDFs>" uv-source
import AppKit
import PDFKit

let args = CommandLine.arguments
let source = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let longEdge: CGFloat = 1400
let files = ["EUR": "Euro.pdf", "CHF": "Swiss Franc.pdf", "RUB": "Russian Ruble.pdf", "GBP": "British pound.pdf"]

for (code, name) in files.sorted(by: { $0.key < $1.key }) {
  guard let doc = PDFDocument(url: source.appendingPathComponent(name)) else {
    print("skip \(name): not found")
    continue
  }
  let dir = output.appendingPathComponent(code)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  for i in 0..<doc.pageCount {
    let page = doc.page(at: i)!
    let box = page.bounds(for: .mediaBox)
    let scale = longEdge / max(box.width, box.height)
    let image = page.thumbnail(of: CGSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
    let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
    let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85])!
    try jpeg.write(to: dir.appendingPathComponent(String(format: "p%02d.jpg", i + 1)))
  }
  print("\(code): \(doc.pageCount) pages")
}
