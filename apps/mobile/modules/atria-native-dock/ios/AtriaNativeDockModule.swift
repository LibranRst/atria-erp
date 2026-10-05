import ExpoModulesCore
import UIKit

public class AtriaNativeDockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AtriaNativeDock")

    View(AtriaNativeSegmentedTabsView.self) {
      Events("onSelect")
      Prop("options") { (view: AtriaNativeSegmentedTabsView, value: [NativeSegmentedOption]) in view.options = value }
      Prop("selectedId") { (view: AtriaNativeSegmentedTabsView, value: String) in view.selectedId = value }
      Prop("scrollable") { (view: AtriaNativeSegmentedTabsView, value: Bool) in view.scrollable = value }
      Prop("activeColor") { (view: AtriaNativeSegmentedTabsView, value: UIColor) in view.activeColor = value }
      Prop("motion") { (view: AtriaNativeSegmentedTabsView, value: NativeSegmentedMotion) in view.motion = value }
      Prop("controlLabel") { (view: AtriaNativeSegmentedTabsView, value: String) in view.controlLabel = value }
      OnViewDidUpdateProps { (view: AtriaNativeSegmentedTabsView) in view.applyChanges() }
    }

    View(AtriaHeaderLeadingControlsView.self) {
      Events("onAction")
      Prop("hasBack") { (view: AtriaHeaderLeadingControlsView, value: Bool) in view.hasBack = value }
      Prop("canUseAI") { (view: AtriaHeaderLeadingControlsView, value: Bool) in view.canUseAI = value }
      OnViewDidUpdateProps { (view: AtriaHeaderLeadingControlsView) in view.applyChanges() }
    }

    View(AtriaNativeActionMenuView.self) {
      Events("onAction")
      Prop("title") { (view: AtriaNativeActionMenuView, value: String) in view.title = value }
      Prop("symbol") { (view: AtriaNativeActionMenuView, value: String) in view.symbol = value }
      Prop("primary") { (view: AtriaNativeActionMenuView, value: Bool) in view.primary = value }
      Prop("menuLabel") { (view: AtriaNativeActionMenuView, value: String) in view.menuLabel = value }
      Prop("actions") { (view: AtriaNativeActionMenuView, value: [NativeMenuAction]) in view.actions = value }
      OnViewDidUpdateProps { (view: AtriaNativeActionMenuView) in view.applyChanges() }
    }

    View(AtriaNativeDockView.self) {
      Events("onSelect", "onAction")
      Prop("tabs") { (view: AtriaNativeDockView, tabs: [DockTab]) in
        view.tabs = tabs
      }
      Prop("selectedId") { (view: AtriaNativeDockView, selectedId: String) in
        view.selectedId = selectedId
      }
      Prop("actions") { (view: AtriaNativeDockView, actions: [DockAction]) in
        view.actions = actions
      }
      OnViewDidUpdateProps { (view: AtriaNativeDockView) in
        view.applyChanges()
      }
    }
  }
}
