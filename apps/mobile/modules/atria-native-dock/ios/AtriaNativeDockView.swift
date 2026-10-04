import ExpoModulesCore
import UIKit
import SwiftUI

private enum AtriaFloatingGlass {
  static var tint: UIColor {
    UIColor.systemBackground.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light)).withAlphaComponent(0.75)
  }

  static func background(frame: CGRect = .zero, clear: Bool = false) -> UIView {
    let view: UIView
    if #available(iOS 26.0, *) { view = AtriaPillGlassBackground(frame: frame, clear: clear) }
    else { view = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialLight)) }
    view.overrideUserInterfaceStyle = .light
    view.isUserInteractionEnabled = false
    view.frame = frame
    return view
  }

  static func restore(_ view: UIView) {
    if #available(iOS 26.0, *), let surface = view as? AtriaPillGlassBackground { surface.restore() }
    else { view.alpha = 1 }
  }
}

/** UIKit owns standard item insertion, removal, movement and glass feedback. */
final class AtriaHeaderLeadingControlsView: ExpoView {
  private let bar = UIToolbar()
  private var back: UIBarButtonItem!
  private var ai: UIBarButtonItem!
  private let separator = UIBarButtonItem.fixedSpace(8)
  private let trailingSpace = UIBarButtonItem.flexibleSpace()
  private var initialized = false
  private var signature = ""
  let onAction = EventDispatcher()
  var hasBack = false
  var canUseAI = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = false
    let appearance = UIToolbarAppearance()
    appearance.configureWithTransparentBackground()
    appearance.shadowColor = .clear
    bar.standardAppearance = appearance
    bar.scrollEdgeAppearance = appearance
    bar.compactAppearance = appearance
    bar.compactScrollEdgeAppearance = appearance
    bar.isTranslucent = true
    bar.overrideUserInterfaceStyle = .light
    bar.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)
    back = makeControl(symbol: "chevron.left", label: "Kembali", id: "back")
    ai = makeControl(symbol: "sparkles", label: "Buka asisten AI · Buka di web", id: "ai")
    bar.setItems([], animated: false)
    addSubview(bar)
  }

  private func makeControl(symbol: String, label: String, id: String) -> UIBarButtonItem {
    let light = UITraitCollection(userInterfaceStyle: .light)
    let foreground = UIColor.label.resolvedColor(with: light)
    let image = UIImage(systemName: symbol)?.withTintColor(foreground, renderingMode: .alwaysOriginal)
    let item = UIBarButtonItem(image: image, primaryAction: UIAction { [weak self] _ in
      self?.onAction(["id": id])
    })
    item.width = 44
    item.accessibilityLabel = label
    item.accessibilityIdentifier = "workspace-\(id)"
    if #available(iOS 26.0, *) {
      item.style = .prominent
      item.tintColor = AtriaFloatingGlass.tint
      item.sharesBackground = false
      item.identifier = "workspace-\(id)"
    }
    if #available(iOS 27.0, *) { item.isPaddingRemoved = true }
    return item
  }

  func applyChanges() {
    let next = "\(hasBack)|\(canUseAI)"
    guard signature != next else { return }
    signature = next
    var items: [UIBarButtonItem] = []
    if hasBack { items.append(back) }
    if #available(iOS 27.0, *), hasBack && canUseAI { items.append(separator) }
    if canUseAI { items.append(ai) }
    items.append(trailingSpace)
    bar.setItems(items, animated: initialized && !UIAccessibility.isReduceMotionEnabled)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    bar.frame = CGRect(x: 0, y: 2, width: bounds.width, height: 44)
    initialized = bounds.width > 0
  }
}

struct DockTab: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var symbol: String = ""
  @Field var selectedSymbol: String = ""
}

struct DockAction: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var description: String = ""
  @Field var symbol: String = ""
  @Field var disabled: Bool = false
  @Field var destructive: Bool = false
}

/** UIKit owns active appearance, touch/scrubbing and menu dismissal. */
final class AtriaNativeDockView: ExpoView, UITabBarControllerDelegate {
  private let tabController = UITabBarController()
  private var tabBar: UITabBar { tabController.tabBar }
  let actionButton = AtriaMenuButton(type: .system)
  let onSelect = EventDispatcher()
  let onAction = EventDispatcher()
  var tabs: [DockTab] = []
  var actions: [DockAction] = []
  var selectedId: String = ""
  private var tabIds: [String] = []
  private var menuSignature: String = ""
  private lazy var actionGlass = AtriaFloatingGlass.background()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    backgroundColor = .clear
    tabController.delegate = self
    tabController.loadViewIfNeeded()
    tabController.view.backgroundColor = .clear
    tabController.overrideUserInterfaceStyle = .light
    if #available(iOS 26.0, *) { tabController.tabBarMinimizeBehavior = .never }
    tabBar.isTranslucent = true
    tabBar.overrideUserInterfaceStyle = .light
    tabBar.tintColor = .label
    tabBar.accessibilityIdentifier = "atria.native-tabs"
    tabBar.accessibilityLabel = "Navigasi utama"
    tabBar.backgroundColor = .clear
    if #available(iOS 26.0, *) {
      // UIKit owns the floating glass platter. Keep its canvas transparent so
      // the scrolling page, rather than a white underlay, supplies the backdrop.
      let appearance = UITabBarAppearance()
      appearance.configureWithTransparentBackground()
      tabBar.standardAppearance = appearance
      tabBar.scrollEdgeAppearance = appearance
    }
    addSubview(tabController.view)
    // One explicit glass material keeps the source bright; UIKit still owns
    // the button's menu and its presentation/dismissal animation.
    actionButton.overrideUserInterfaceStyle = .light
    var configuration = UIButton.Configuration.plain()
    configuration.baseForegroundColor = .label
    configuration.image = UIImage(systemName: "plus")
    configuration.cornerStyle = .capsule
    configuration.buttonSize = .large
    actionButton.configuration = configuration
    actionButton.showsMenuAsPrimaryAction = true
    actionButton.changesSelectionAsPrimaryAction = false
    actionButton.accessibilityIdentifier = "atria.quick-actions"
    actionButton.accessibilityLabel = "Aksi cepat"
    actionButton.insertSubview(actionGlass, at: 0)
    if let image = actionButton.imageView { actionButton.bringSubviewToFront(image) }
    actionButton.onMenuWillOpen = { [weak self] in self?.actionGlass.alpha = 0 }
    actionButton.onMenuWillClose = { [weak self] in
      guard let self else { return }
      AtriaFloatingGlass.restore(self.actionGlass)
    }
    addSubview(actionButton)
  }

  func applyChanges() {
    let identifiers = tabs.map(\.id)
    if identifiers != tabIds {
      tabIds = identifiers
      let controllers = tabs.enumerated().map { index, tab in
        let item = UITabBarItem(title: tab.label, image: UIImage(systemName: tab.symbol), selectedImage: UIImage(systemName: tab.selectedSymbol))
        item.tag = index
        item.accessibilityIdentifier = "atria.tab.\(tab.id)"
        let controller = UIViewController()
        controller.view.backgroundColor = .clear
        controller.tabBarItem = item
        return controller
      }
      tabController.setViewControllers(controllers, animated: false)
    }
    if let index = tabIds.firstIndex(of: selectedId),
       tabController.selectedIndex != index {
      tabController.selectedIndex = index
    }
    let signature = actions.map {
      "\($0.id)|\($0.label)|\($0.description)|\($0.symbol)|\($0.disabled)|\($0.destructive)"
    }.joined(separator: "\n")
    if signature != menuSignature {
      menuSignature = signature
      let children = actions.map { action in
        var attributes: UIMenuElement.Attributes = []
        if action.disabled { attributes.insert(.disabled) }
        if action.destructive { attributes.insert(.destructive) }
        let item = UIAction(title: action.label, image: UIImage(systemName: action.symbol), identifier: UIAction.Identifier(action.id), attributes: attributes) { [weak self] _ in
          // Begin the destination while UIKit closes its menu. Waiting for the
          // closing morph adds seconds before native-stack can show a sheet.
          self?.onAction(["id": action.id])
        }
        return item
      }
      if children.isEmpty {
        actionButton.menu = nil
      } else {
        let menu = UIMenu(children: children)
        menu.preferredElementSize = .large
        actionButton.menu = menu
      }
    }
    actionButton.isHidden = actions.isEmpty
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let buttonSize = min(bounds.height, 64)
    // Native tab controllers inset the visible platter inside their frame.
    // Allow that non-interactive trailing inset to share the action's gutter.
    let trailingInset: CGFloat
    if #available(iOS 26.0, *) {
      // UIKit's floating platter retains a 20pt external gutter even when the
      // embedded controller's narrow view reports only its 8pt content margin.
      trailingInset = max(20, max(tabBar.layoutMargins.right, tabController.systemMinimumLayoutMargins.trailing))
    } else {
      trailingInset = 0
    }
    let gap: CGFloat = actions.isEmpty ? 0 : 8 - max(0, trailingInset)
    let tabWidth = max(0, bounds.width - (actions.isEmpty ? 0 : buttonSize + gap))
    // The platter's leading inset is invisible while the FAB ends at the outer
    // frame. Center their visible union, keeping the existing visual gutter.
    let visualOffsetX = actions.isEmpty ? 0 : -trailingInset / 2
    tabController.view.frame = CGRect(x: visualOffsetX, y: 0, width: tabWidth, height: bounds.height)
    tabController.view.layoutIfNeeded()
    // UITabBar includes its own bottom safe-area space. Give its controller that
    // space below the control row instead of compressing UIKit's item geometry.
    let nativeHeight = max(bounds.height, tabBar.bounds.height)
    if nativeHeight > bounds.height {
      tabController.view.frame.size.height = nativeHeight
      tabController.view.layoutIfNeeded()
    }
    actionButton.frame = CGRect(x: bounds.width - buttonSize + visualOffsetX, y: (bounds.height - buttonSize) / 2, width: buttonSize, height: buttonSize)
    actionButton.menuPreviewLift = buttonSize + 12
    actionGlass.frame = actionButton.bounds
    if #unavailable(iOS 26.0) {
      actionGlass.layer.cornerRadius = buttonSize / 2
      actionGlass.clipsToBounds = true
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil, tabController.parent == nil {
      var responder: UIResponder? = next
      while let current = responder {
        if let parent = current as? UIViewController {
          parent.addChild(tabController)
          tabController.didMove(toParent: parent)
          break
        }
        responder = current.next
      }
    } else if window == nil, tabController.parent != nil {
      tabController.willMove(toParent: nil)
      tabController.removeFromParent()
    }
  }

  func tabBarController(_ controller: UITabBarController, didSelect viewController: UIViewController) {
    let index = controller.selectedIndex
    guard tabs.indices.contains(index) else { return }
    onSelect(["id": tabs[index].id])
  }
}


/** Keep the anchor alive until UIKit finishes its closing morph. */
final class AtriaMenuButton: UIButton {
  private enum MenuPhase { case closed, presented, dismissing }
  var pendingAction: (() -> Void)?
  var isMenuActive: Bool { menuPhase != .closed }
  var isMenuDismissing: Bool { menuPhase == .dismissing }
  var onMenuClosed: (() -> Void)?
  var onMenuWillOpen: (() -> Void)?
  var onMenuWillClose: (() -> Void)?
  var beforeMenuOpen: (() -> Void)?
  // Only the dock opts in. The real control and its dismissal target stay put.
  var menuPreviewLift: CGFloat = 0
  private var menuPhase: MenuPhase = .closed
  private var presentationGeneration = 0

  override func menuAttachmentPoint(for configuration: UIContextMenuConfiguration) -> CGPoint {
    var point = super.menuAttachmentPoint(for: configuration)
    point.y -= menuPreviewLift
    return point
  }

  override func contextMenuInteraction(_ interaction: UIContextMenuInteraction, previewForHighlightingMenuWithConfiguration configuration: UIContextMenuConfiguration) -> UITargetedPreview? {
    let nativePreview = super.contextMenuInteraction(interaction, previewForHighlightingMenuWithConfiguration: configuration)
    guard menuPreviewLift > 0 else { return nativePreview }
    let preview = nativePreview ?? UITargetedPreview(view: self)
    var center = preview.target.center
    center.y -= menuPreviewLift
    return preview.retargetedPreview(with: UIPreviewTarget(container: preview.target.container, center: center))
  }

  override func contextMenuInteraction(_ interaction: UIContextMenuInteraction, previewForDismissingMenuWithConfiguration configuration: UIContextMenuConfiguration) -> UITargetedPreview? {
    let nativePreview = super.contextMenuInteraction(interaction, previewForDismissingMenuWithConfiguration: configuration)
    guard menuPreviewLift > 0 else { return nativePreview }
    return nativePreview ?? UITargetedPreview(view: self)
  }

  override func contextMenuInteraction(_ interaction: UIContextMenuInteraction, configurationForMenuAtLocation location: CGPoint) -> UIContextMenuConfiguration? {
    // Refresh before UIKit snapshots a new menu, even during a prior closing.
    beforeMenuOpen?()
    return super.contextMenuInteraction(interaction, configurationForMenuAtLocation: location)
  }

  override func contextMenuInteraction(_ interaction: UIContextMenuInteraction, willDisplayMenuFor configuration: UIContextMenuConfiguration, animator: UIContextMenuInteractionAnimating?) {
    pendingAction = nil
    presentationGeneration += 1
    menuPhase = .presented
    super.contextMenuInteraction(interaction, willDisplayMenuFor: configuration, animator: animator)
    let generation = presentationGeneration
    let display: () -> Void = { [weak self] in
      guard let self, self.presentationGeneration == generation,
            self.menuPhase == .presented else { return }
      self.onMenuWillOpen?()
    }
    if let animator { animator.addAnimations(display) }
    else { display() }
  }

  override func contextMenuInteraction(_ interaction: UIContextMenuInteraction, willEndFor configuration: UIContextMenuConfiguration, animator: UIContextMenuInteractionAnimating?) {
    menuPhase = .dismissing
    super.contextMenuInteraction(interaction, willEndFor: configuration, animator: animator)
    let generation = presentationGeneration
    let dismiss: () -> Void = { [weak self] in
      guard let self, self.presentationGeneration == generation,
            self.menuPhase == .dismissing else { return }
      self.onMenuWillClose?()
    }
    let complete: () -> Void = { [weak self] in
      guard let self, self.presentationGeneration == generation,
            self.menuPhase == .dismissing else { return }
      let action = self.pendingAction
      self.pendingAction = nil
      self.menuPhase = .closed
      self.onMenuClosed?()
      action?()
    }
    if let animator {
      animator.addAnimations(dismiss)
      animator.addCompletion(complete)
    } else {
      dismiss()
      DispatchQueue.main.async(execute: complete)
    }
  }
}

struct NativeMenuAction: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var symbol: String = ""
  @Field var selectedSymbol: String = ""
  @Field var disabled: Bool = false
  @Field var destructive: Bool = false
  @Field var selected: Bool = false
  @Field var destinationTitle: String = ""
}

@available(iOS 26.0, *)
private struct AtriaPillGlassContent: SwiftUI.View {
  var clear = false
  var body: some SwiftUI.View {
    Color.clear
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .glassEffect(clear ? .clear.interactive() : .regular.tint(Color(uiColor: AtriaFloatingGlass.tint)).interactive(), in: Capsule())
      .environment(\.colorScheme, .light)
  }
}

@available(iOS 26.0, *)
private final class AtriaPillGlassBackground: UIView {
  private let host: UIHostingController<AtriaPillGlassContent>

  init(frame: CGRect, clear: Bool = false) {
    host = UIHostingController(rootView: AtriaPillGlassContent(clear: clear))
    super.init(frame: frame)
    overrideUserInterfaceStyle = .light
    host.overrideUserInterfaceStyle = .light
    host.view.overrideUserInterfaceStyle = .light
    host.view.backgroundColor = .clear
    host.view.isUserInteractionEnabled = false
    addSubview(host.view)
  }

  required init?(coder: NSCoder) { return nil }

  func restore() {
    alpha = 1
    host.view.setNeedsLayout()
    host.view.layoutIfNeeded()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    host.view.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      if host.parent != nil {
        host.willMove(toParent: nil)
        host.removeFromParent()
      }
      return
    }
    guard host.parent == nil else { return }
    var responder = next
    while let candidate = responder {
      if let parent = candidate as? UIViewController {
        parent.addChild(host)
        host.didMove(toParent: parent)
        break
      }
      responder = candidate.next
    }
  }
}

final class AtriaNativeActionMenuView: ExpoView {
  private let button = AtriaMenuButton(type: .system)
  private lazy var titleGlass: UIView = {
    if #available(iOS 26.0, *) { return AtriaPillGlassBackground(frame: .zero) }
    return UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
  }()
  let onAction = EventDispatcher()
  var title: String = ""
  var symbol: String = ""
  var primary: Bool = false
  var menuLabel: String = ""
  var actions: [NativeMenuAction] = []
  private var titleOnly: Bool { !primary && !title.isEmpty && symbol.isEmpty }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    backgroundColor = .clear
    button.showsMenuAsPrimaryAction = true
    button.changesSelectionAsPrimaryAction = false
    button.onMenuWillOpen = { [weak self] in
      guard let self, self.titleOnly else { return }
      self.titleGlass.alpha = 0
    }
    button.onMenuWillClose = { [weak self] in
      guard let self, self.titleOnly else { return }
      if #available(iOS 26.0, *),
         let surface = self.titleGlass as? AtriaPillGlassBackground { surface.restore() }
      else { self.titleGlass.alpha = 1 }
    }
    button.onMenuClosed = { [weak self] in self?.updateMenu() }
    button.beforeMenuOpen = { [weak self] in self?.updateMenu() }
    addSubview(button)
  }

  func applyChanges() {
    var config: UIButton.Configuration
    // SwiftUI renders one native glass surface inside the existing button.
    // UIKit hides and restores the surface alongside the menu's own morph.
    if titleOnly { config = .plain() }
    else if #available(iOS 26.0, *) { config = primary ? .prominentGlass() : .glass() }
    else { config = primary ? .filled() : .tinted() }
    config.baseForegroundColor = primary ? .systemBackground : .label
    config.baseBackgroundColor = titleOnly ? nil : .label
    config.cornerStyle = .capsule
    config.title = title.isEmpty ? nil : title
    config.image = symbol.isEmpty ? nil : UIImage(systemName: symbol)
    config.imagePadding = 6
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
      var result = attributes
      result.font = .systemFont(ofSize: 12, weight: .semibold)
      return result
    }
    button.configuration = config
    if titleOnly {
      if titleGlass.superview !== button { button.insertSubview(titleGlass, at: 0) }
      titleGlass.isUserInteractionEnabled = false
      // Route props may arrive during closing; let its animator own the alpha.
      if !button.isMenuDismissing { titleGlass.alpha = button.isMenuActive ? 0 : 1 }
      if let label = button.titleLabel { button.bringSubviewToFront(label) }
    } else { titleGlass.removeFromSuperview() }
    button.titleLabel?.numberOfLines = 1
    button.titleLabel?.lineBreakMode = .byTruncatingTail
    button.accessibilityLabel = menuLabel
    if !button.isMenuActive { updateMenu() }
  }

  private func updateMenu() {
    button.menu = UIMenu(children: actions.map { action in
      var attributes: UIMenuElement.Attributes = []
      if action.disabled { attributes.insert(.disabled) }
      if action.destructive { attributes.insert(.destructive) }
      // Active icons come from the catalog; UIKit .on would add a checkmark.
      let symbol = action.selected && !action.selectedSymbol.isEmpty ? action.selectedSymbol : action.symbol
      return UIAction(title: action.label, image: UIImage(systemName: symbol), identifier: UIAction.Identifier(action.id), attributes: attributes, state: .off) { [weak self] _ in
        guard let self else { return }
        if action.id == "sign-out" {
          // Auth teardown removes this anchor. Finish dismissal before changing
          // the key-window/input owner; ordinary page selection stays instant.
          self.button.pendingAction = { [weak self] in self?.onAction(["id": action.id]) }
          return
        }
        if !action.destinationTitle.isEmpty {
          // Stage the active icon together with the title, before the JS route
          // update, so an immediate reopen doesn't reuse old selection.
          for index in self.actions.indices {
            self.actions[index].selected = self.actions[index].id == action.id
          }
          var config = self.button.configuration
          config?.title = action.destinationTitle
          self.button.configuration = config
          self.button.layoutIfNeeded()
        }
        // Navigation is immediate. Only menu children await dismissal.
        self.onAction(["id": action.id])
      }
    })
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = titleOnly ? bounds.insetBy(dx: 0, dy: 2) : bounds
    if titleOnly {
      titleGlass.frame = button.bounds
      if #unavailable(iOS 26.0) {
        titleGlass.layer.cornerRadius = button.bounds.height / 2
        titleGlass.clipsToBounds = true
      }
    }
  }
}
