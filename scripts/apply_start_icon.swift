import Cocoa
import Foundation

let root = FileManager.default.currentDirectoryPath

func applyIcon(iconName: String, commandName: String) {
    let iconPath = (root as NSString).appendingPathComponent("public/" + iconName)
    let filePath = (root as NSString).appendingPathComponent(commandName)
    
    guard FileManager.default.fileExists(atPath: iconPath) else {
        print("Skipping: \(iconName) does not exist in public/.")
        return
    }
    
    guard FileManager.default.fileExists(atPath: filePath) else {
        print("Skipping: \(commandName) does not exist in root.")
        return
    }
    
    guard let image = NSImage(contentsOfFile: iconPath) else {
        fputs("Failed to load \(iconName) from public/\n", stderr)
        return
    }
    
    if NSWorkspace.shared.setIcon(image, forFile: filePath, options: []) {
        print("Successfully applied \(iconName) to \(commandName)")
    } else {
        fputs("Failed to apply \(iconName) to \(commandName)\n", stderr)
    }
}

applyIcon(iconName: "Start.icon.png", commandName: "Start.command")
applyIcon(iconName: "Start.icon.png", commandName: "Start.app")
applyIcon(iconName: "Install.icon.png", commandName: "Install.command")