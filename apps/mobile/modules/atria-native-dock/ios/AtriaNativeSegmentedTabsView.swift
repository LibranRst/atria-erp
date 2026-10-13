import ExpoModulesCore
import UIKit

struct NativeSegmentedOption: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var iconData: String = ""
  @Field var badge: Int = -1
  @Field var disabled: Bool = false
}

struct NativeSegmentedMotion: Record {
  @Field var stiffness: Double = 0
  @Field var damping: Double = 0
  @Field var mass: Double = 0
  @Field var duration: Double = 0
}

/// Observes touch lifetime without replacing the system control's tracking.
/// All pointer selection commits through one release boundary, regardless of
/// when UIKit's valueChanged arrives relative to recognizer callbacks.
private final class AtriaSegmentTouchObserver: UIGestureRecognizer {
  var began: ((CGPoint) -> Void)?
  var moved: ((CGPoint) -> Void)?
  var ended: ((CGPoint) -> Void)?
  var cancelled: (() -> Void)?
  private var trackedTouch: UITouch?

  override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
  override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    guard trackedTouch == nil, touches.count == 1, let touch = touches.first else {
      cancelled?()
      trackedTouch = nil
      state = .failed
      return
    }
    trackedTouch = touch
    began?(touch.location(in: view))
    // This recognizer only observes. Entering .began here claims every touch
    // before UIKit can decide whether it belongs to the horizontal scroll pan.
    // Stay .possible and never recognize an action of our own.
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let touch = trackedTouch, touches.contains(touch) else { return }
    moved?(touch.location(in: view))
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let touch = trackedTouch, touches.contains(touch) else { return }
    trackedTouch = nil
    ended?(touch.location(in: view))
    state = .failed
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
    guard trackedTouch != nil else { return }
    trackedTouch = nil
    cancelled?()
    state = .failed
  }

  override func reset() {
    // A competing native recognizer can fail an observer without delivering
    // touchesCancelled. Do not leave a preview or pointer gate active then.
    if trackedTouch != nil { cancelled?() }
    trackedTouch = nil
    super.reset()
  }

}

private final class AtriaSegmentScrollView: UIScrollView {
  var isScrubbing = false

  override func touchesShouldCancel(in view: UIView) -> Bool {
    // UIScrollView otherwise refuses to cancel UIControl touch tracking.
    return !isScrubbing
  }
}

/// A native button label with the web icon / text / count composition.
private final class AtriaSegmentButton: UIButton {
  let icon = UIImageView()
  let label = UILabel()
  let badge = UILabel()
  private let content = UIView()
  private let badgeContainer = UIView()
  var option = NativeSegmentedOption()

  override init(frame: CGRect) {
    super.init(frame: frame)
    var config = UIButton.Configuration.plain()
    config.contentInsets = .zero
    config.background = .clear()
    config.background.backgroundColorTransformer = UIConfigurationColorTransformer { _ in .clear }
    configuration = config
    content.isUserInteractionEnabled = false
    icon.contentMode = .scaleAspectFit
    label.adjustsFontForContentSizeCategory = true
    label.lineBreakMode = .byTruncatingTail
    badge.textAlignment = .center
    badge.adjustsFontForContentSizeCategory = true
    badgeContainer.addSubview(badge)
    content.addSubview(icon)
    content.addSubview(label)
    content.addSubview(badgeContainer)
    addSubview(content)
    isAccessibilityElement = true
  }

  required init?(coder: NSCoder) { return nil }

  func configure(_ value: NativeSegmentedOption) {
    option = value
    label.text = value.label
    icon.image = AtriaIconImage.decode(value.iconData)
    icon.isHidden = icon.image == nil
    badge.text = value.badge > 99 ? "99+" : String(value.badge)
    badgeContainer.isHidden = value.badge < 0
    isEnabled = !value.disabled
    accessibilityLabel = value.badge < 0 ? value.label : "\(value.label), \(value.badge) memerlukan perhatian"
    accessibilityHint = "Ketuk untuk memilih. Geser untuk melihat tab lain."
    accessibilityIdentifier = "atria.segment.\(value.id)"
    updateFonts()
  }

  func updateFonts() {
    label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 13, weight: .semibold))
    badge.font = UIFontMetrics(forTextStyle: .caption2).scaledFont(for: .systemFont(ofSize: 10, weight: .bold))
    icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: UIFontMetrics.default.scaledValue(for: 15), weight: .regular)
  }

  func showSelected(_ selected: Bool) {
    isSelected = selected
    let color: UIColor = selected ? .white : .secondaryLabel
    label.textColor = color
    icon.tintColor = color
    badge.textColor = selected ? .white : .label
    badgeContainer.backgroundColor = selected ? UIColor.white.withAlphaComponent(0.12) : .tertiarySystemFill
    alpha = isEnabled ? 1 : 0.4
    accessibilityTraits = selected ? [.button, .selected] : .button
    if !isEnabled { accessibilityTraits.insert(.notEnabled) }
  }

  var preferredWidth: CGFloat {
    let textWidth = label.intrinsicContentSize.width
    let iconWidth: CGFloat = icon.isHidden ? 0 : UIFontMetrics.default.scaledValue(for: 15) + 6
    let countWidth: CGFloat = badgeContainer.isHidden ? 0 : max(16, badge.intrinsicContentSize.width + 8) + 6
    return max(48, ceil(textWidth + iconWidth + countWidth + 24))
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let iconSize = UIFontMetrics.default.scaledValue(for: 15)
    let badgeHeight = max(16, badge.intrinsicContentSize.height)
    // Explicit frames keep the decorative stack inside the native button.
    let countWidth = badgeContainer.isHidden ? 0 : max(16, badge.intrinsicContentSize.width + 8)
    let iconWidth: CGFloat = icon.isHidden ? 0 : iconSize
    let labelWidth = min(label.intrinsicContentSize.width, max(0, bounds.width - 24 - iconWidth - countWidth - (icon.isHidden ? 0 : 6) - (badgeContainer.isHidden ? 0 : 6)))
    let width = labelWidth + iconWidth + countWidth + (icon.isHidden ? 0 : 6) + (badgeContainer.isHidden ? 0 : 6)
    content.frame = CGRect(x: (bounds.width - width) / 2, y: (bounds.height - max(label.intrinsicContentSize.height, badgeHeight)) / 2, width: width, height: max(label.intrinsicContentSize.height, badgeHeight))
    icon.frame = CGRect(x: 0, y: (content.bounds.height - iconSize) / 2, width: iconWidth, height: iconSize)
    let textX = icon.isHidden ? 0 : iconWidth + 6
    label.frame = CGRect(x: textX, y: 0, width: labelWidth, height: content.bounds.height)
    badgeContainer.frame = CGRect(x: textX + labelWidth + 6, y: (content.bounds.height - badgeHeight) / 2, width: countWidth, height: badgeHeight)
    badgeContainer.layer.cornerRadius = badgeHeight / 2
    badge.frame = CGRect(x: 4, y: 0, width: max(0, countWidth - 8), height: badgeHeight)
  }
}

final class AtriaNativeSegmentedTabsView: ExpoView, UIGestureRecognizerDelegate, UIScrollViewDelegate {
  let onSelect = EventDispatcher()
  var options: [NativeSegmentedOption] = []
  var selectedId = ""
  var scrollable = false
  var controlLabel = ""
  var activeColor: UIColor = .label
  var motion = NativeSegmentedMotion()

  private let scrollView = AtriaSegmentScrollView()
  private let content = UIView()
  private let indicator = UIVisualEffectView()
  private let touchObserver = AtriaSegmentTouchObserver()
  private let hold = UILongPressGestureRecognizer()
  private let feedback = UISelectionFeedbackGenerator()
  private var buttons: [AtriaSegmentButton] = []
  private var renderedSignature: [String] = []
  private var segmentWidths: [CGFloat] = []
  private var committedIndex = -1
  private var previewIndex = -1
  private var originalIndex = -1
  private var touchActive = false
  private var scrollOnly = false
  private var ignoresPointerActions = false
  private var touchPoint = CGPoint.zero
  private var displayLink: CADisplayLink?
  private var lastEdgeTimestamp: CFTimeInterval = 0
  private var revealSelection = true
  private var indicatorAnimator: UIViewPropertyAnimator?
  private var indicatorTarget = CGRect.zero
  private var renderedActiveColor: UIColor?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    overrideUserInterfaceStyle = .light
    backgroundColor = .systemGray6
    clipsToBounds = true
    scrollView.backgroundColor = .clear
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.showsVerticalScrollIndicator = false
    scrollView.alwaysBounceVertical = false
    scrollView.contentInsetAdjustmentBehavior = .never
    scrollView.delaysContentTouches = false
    scrollView.canCancelContentTouches = true
    scrollView.delegate = self
    addSubview(scrollView)
    scrollView.addSubview(content)
    indicator.isUserInteractionEnabled = false
    content.addSubview(indicator)
    touchObserver.cancelsTouchesInView = false
    touchObserver.delaysTouchesBegan = false
    touchObserver.delaysTouchesEnded = false
    touchObserver.delegate = self
    touchObserver.began = { [weak self] point in self?.beginTouch(at: point) }
    touchObserver.moved = { [weak self] point in self?.moveTouch(to: point) }
    touchObserver.ended = { [weak self] point in self?.endTouch(at: point) }
    touchObserver.cancelled = { [weak self] in self?.cancelTouch() }
    scrollView.addGestureRecognizer(touchObserver)
    hold.minimumPressDuration = 0.22
    hold.allowableMovement = 10
    hold.cancelsTouchesInView = false
    hold.delegate = self
    hold.addTarget(self, action: #selector(holdChanged))
    scrollView.addGestureRecognizer(hold)
    scrollView.panGestureRecognizer.require(toFail: hold)
  }

  func applyChanges() {
    let signature = options.map { "\($0.id)|\($0.label)|\($0.iconData)|\($0.badge)|\($0.disabled)" }
    if signature != renderedSignature {
      cancelTouch()
      renderedSignature = signature
      buttons.forEach { $0.removeFromSuperview() }
      buttons = options.enumerated().map { index, option in
        let button = AtriaSegmentButton(type: .system)
        button.configure(option)
        button.addAction(UIAction { [weak self] _ in
          guard let self, !self.touchActive, !self.ignoresPointerActions else { return }
          self.commit(index: index)
        }, for: .touchUpInside)
        content.addSubview(button)
        return button
      }
      revealSelection = true
    }
    if renderedActiveColor != activeColor {
      renderedActiveColor = activeColor
      if #available(iOS 26.0, *) {
        let glass = UIGlassEffect(style: .regular)
        glass.tintColor = activeColor
        indicator.effect = glass
        indicator.cornerConfiguration = .capsule()
      } else { indicator.backgroundColor = activeColor }
    }
    buttons.forEach { $0.tintColor = activeColor }
    scrollView.accessibilityLabel = controlLabel
    let next = options.firstIndex { $0.id == selectedId } ?? -1
    if touchActive, next != committedIndex { cancelTouch() }
    if !touchActive {
      if committedIndex != next { revealSelection = true }
      committedIndex = next
      show(index: next, animated: false)
    }
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    layer.cornerRadius = bounds.height / 2
    scrollView.frame = bounds.insetBy(dx: 4, dy: 0)
    buttons.forEach { $0.updateFonts() }
    let viewportWidth = scrollView.bounds.width
    let minimumWidths = buttons.map(\.preferredWidth)
    let minimumTotal = minimumWidths.reduce(0, +)
    let width = scrollable ? max(viewportWidth, minimumTotal) : viewportWidth
    segmentWidths = scrollable && minimumTotal > viewportWidth ? minimumWidths : Array(repeating: width / CGFloat(max(1, buttons.count)), count: buttons.count)
    var x: CGFloat = 0
    for (index, button) in buttons.enumerated() {
      button.frame = CGRect(x: x, y: 0, width: segmentWidths[index], height: bounds.height)
      x += segmentWidths[index]
    }
    content.frame = CGRect(x: 0, y: 0, width: width, height: bounds.height)
    scrollView.contentSize = content.bounds.size
    scrollView.isScrollEnabled = width > viewportWidth
    show(index: previewIndex, animated: false)
    if revealSelection, !touchActive {
      revealSelection = false
      reveal(index: committedIndex, animated: false)
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { cancelTouch() }
  }

  private func show(index: Int, animated: Bool) {
    buttons.enumerated().forEach { $0.element.showSelected($0.offset == index) }
    guard buttons.indices.contains(index) else {
      previewIndex = index
      indicator.isHidden = true
      return
    }
    indicator.isHidden = false
    let target = buttons[index].frame.insetBy(dx: 0, dy: 4)
    guard previewIndex != index || indicatorTarget != target else { return }
    previewIndex = index
    indicatorTarget = target
    indicatorAnimator?.stopAnimation(true)
    indicator.layer.cornerRadius = target.height / 2
    indicator.clipsToBounds = true
    if animated, !UIAccessibility.isReduceMotionEnabled, motion.stiffness > 0 {
      let timing = UISpringTimingParameters(mass: CGFloat(motion.mass), stiffness: CGFloat(motion.stiffness), damping: CGFloat(motion.damping), initialVelocity: .zero)
      let animator = UIViewPropertyAnimator(duration: motion.duration, timingParameters: timing)
      animator.addAnimations { [weak self] in self?.indicator.frame = target }
      indicatorAnimator = animator
      animator.startAnimation()
    } else { indicator.frame = target }
  }

  private func beginTouch(at point: CGPoint) {
    touchActive = true
    ignoresPointerActions = true
    scrollOnly = false
    originalIndex = committedIndex
    touchPoint = point
    feedback.prepare()
  }

  private func ancestorIsDragging() -> Bool {
    var ancestor = superview
    while let view = ancestor {
      if let scroll = view as? UIScrollView, scroll.isDragging { return true }
      ancestor = view.superview
    }
    return false
  }

  private func moveTouch(to point: CGPoint) {
    touchPoint = point
    if !scrollView.isScrubbing, ancestorIsDragging() { scrollOnly = true }
    if scrollView.isScrubbing { show(index: index(at: point) ?? originalIndex, animated: false) }
  }

  private func endTouch(at point: CGPoint) {
    guard touchActive else { return }
    let next = scrollOnly || ancestorIsDragging() ? nil : index(at: point)
    stopScrubbing()
    touchActive = false
    if let next { commit(index: next) } else { show(index: originalIndex, animated: false) }
    finishPointerActions()
  }

  private func cancelTouch() {
    if touchActive { show(index: originalIndex, animated: false) }
    touchActive = false
    scrollOnly = false
    stopScrubbing()
    finishPointerActions()
  }

  private func finishPointerActions() {
    DispatchQueue.main.async { [weak self] in
      guard let self, !self.touchActive else { return }
      self.show(index: self.committedIndex, animated: false)
      self.ignoresPointerActions = false
    }
  }

  private func commit(index: Int) {
    guard options.indices.contains(index), !options[index].disabled else { return }
    show(index: index, animated: true)
    guard index != committedIndex else { return }
    committedIndex = index
    feedback.selectionChanged()
    reveal(index: index, animated: !UIAccessibility.isReduceMotionEnabled)
    onSelect(["id": options[index].id])
  }

  private func index(at point: CGPoint) -> Int? {
    guard CGRect(origin: scrollView.contentOffset, size: scrollView.bounds.size).contains(point) else { return nil }
    return buttons.indices.first { buttons[$0].frame.contains(point) && !options[$0].disabled }
  }

  @objc private func holdChanged() {
    switch hold.state {
    case .began:
      guard touchActive, !scrollOnly else { return }
      scrollView.isScrubbing = true
      touchPoint = hold.location(in: scrollView)
      show(index: index(at: touchPoint) ?? originalIndex, animated: false)
      let link = CADisplayLink(target: self, selector: #selector(advanceEdgeScroll))
      link.add(to: .main, forMode: .common)
      displayLink = link
    case .changed:
      touchPoint = hold.location(in: scrollView)
      if scrollView.isScrubbing { show(index: index(at: touchPoint) ?? originalIndex, animated: false) }
    case .cancelled, .failed:
      if scrollView.isScrubbing { cancelTouch() }
    case .ended: stopScrubbing()
    default: break
    }
  }

  private func stopScrubbing() {
    scrollView.isScrubbing = false
    displayLink?.invalidate()
    displayLink = nil
    lastEdgeTimestamp = 0
  }

  @objc private func advanceEdgeScroll(_ link: CADisplayLink) {
    let elapsed = lastEdgeTimestamp == 0 ? 0 : min(0.05, link.timestamp - lastEdgeTimestamp)
    lastEdgeTimestamp = link.timestamp
    guard scrollView.isScrubbing, scrollView.bounds.width > 0, touchPoint.y >= 0, touchPoint.y <= bounds.height else { return }
    let localX = touchPoint.x - scrollView.contentOffset.x
    let band = min(40, scrollView.bounds.width / 4)
    guard localX >= 0, localX <= scrollView.bounds.width else { return }
    let velocity: CGFloat
    if localX < band { velocity = -90 * (1 - localX / band) }
    else if localX > scrollView.bounds.width - band { velocity = 90 * (1 - (scrollView.bounds.width - localX) / band) }
    else { return }
    let maximum = max(0, scrollView.contentSize.width - scrollView.bounds.width)
    let offset = min(maximum, max(0, scrollView.contentOffset.x + velocity * CGFloat(elapsed)))
    let delta = offset - scrollView.contentOffset.x
    guard delta != 0 else { return }
    scrollView.setContentOffset(CGPoint(x: offset, y: 0), animated: false)
    touchPoint.x += delta
    show(index: index(at: touchPoint) ?? originalIndex, animated: false)
  }

  private func reveal(index: Int, animated: Bool) {
    guard buttons.indices.contains(index), scrollView.bounds.width > 0 else { return }
    let maximum = max(0, scrollView.contentSize.width - scrollView.bounds.width)
    let x = min(maximum, max(0, buttons[index].frame.midX - scrollView.bounds.width / 2))
    scrollView.setContentOffset(CGPoint(x: x, y: 0), animated: animated)
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    scrollOnly = true
    show(index: committedIndex, animated: false)
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    if gestureRecognizer === touchObserver || otherGestureRecognizer === touchObserver { return true }
    return gestureRecognizer === hold && !(otherGestureRecognizer.view is UIScrollView)
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    gestureRecognizer === hold && otherGestureRecognizer is UIPanGestureRecognizer && otherGestureRecognizer.view is UIScrollView
  }
}
