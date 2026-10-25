// IDE-01: the project's Map tab, for the editor action and the Home tab to reach.
package aisus.intellij

import com.intellij.openapi.components.Service

@Service(Service.Level.PROJECT)
class AisusProject {
    var map: MapPanel? = null
}
