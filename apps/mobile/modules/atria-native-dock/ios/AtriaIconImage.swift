import UIKit

/// Hugeicons templates, decoded locally; the native control owns tint and state.
enum AtriaIconImage {
  private static let cache: NSCache<NSString, UIImage> = {
    let value = NSCache<NSString, UIImage>()
    value.countLimit = 128
    return value
  }()

  static func decode(_ encoded: String) -> UIImage? {
    guard !encoded.isEmpty else { return nil }
    let key = encoded as NSString
    if let image = cache.object(forKey: key) { return image }
    guard let data = Data(base64Encoded: encoded),
          let image = UIImage(data: data, scale: 3)?.withRenderingMode(.alwaysTemplate) else {
      return nil
    }
    cache.setObject(image, forKey: key)
    return image
  }
}
