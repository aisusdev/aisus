// IDE-01: the viewer, the core CLI and the skills ship inside the plugin as aisus-core.zip. Node needs
// real files, so the zip is unpacked once per plugin version under the IDE's system folder.
package aisus.intellij

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.application.PathManager
import com.intellij.openapi.extensions.PluginId
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.zip.ZipInputStream

object AisusCore {
    const val PLUGIN_ID = "dev.aisus"

    /** The unpacked core, unpacking it on first use. */
    @Synchronized
    fun home(): Path {
        val version = PluginManagerCore.getPlugin(PluginId.getId(PLUGIN_ID))?.version ?: "dev"
        val target = Path.of(PathManager.getSystemPath(), "aisus", version)
        if (Files.isRegularFile(target.resolve("dist/cli/aisus.mjs"))) return target
        val zip = AisusCore::class.java.getResourceAsStream("/aisus/aisus-core.zip") ?: throw IOException("The plugin is missing aisus-core.zip.")
        zip.use { unpack(it, target) }
        return target
    }

    fun cli(): Path = home().resolve("dist/cli/aisus.mjs")

    fun viewerScript(): String = Files.readString(home().resolve("viewer/jcef.js"))

    fun viewerStyle(): String = Files.readString(home().resolve("viewer/jcef.css"))

    /** Unpacks [zip] into [target], refusing any entry that would land outside it. */
    fun unpack(zip: InputStream, target: Path) {
        val root = target.toAbsolutePath().normalize()
        ZipInputStream(zip).use { entries ->
            while (true) {
                val entry = entries.nextEntry ?: break
                val out = root.resolve(entry.name).normalize()
                if (!out.startsWith(root) || out == root) throw IOException("aisus-core.zip has an entry outside its folder: ${entry.name}")
                if (entry.isDirectory) {
                    Files.createDirectories(out)
                } else {
                    Files.createDirectories(out.parent)
                    Files.copy(entries, out, StandardCopyOption.REPLACE_EXISTING)
                }
            }
        }
    }
}
