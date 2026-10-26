// IDE-01: the repository's maps, newest first, as the extension lists them: every run folder in
// .archify/ with a candidate.json. Run folders named with a timestamp sort by it, then by their
// counter; the rest sort by the candidate's modification time, after them.
package aisus.intellij

import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.io.path.name

data class MapFile(val run: String, val file: Path)

object Maps {
    private val STAMP = Regex("""(\d{8}-\d{6})(?:-(\d+))?$""")

    fun list(root: Path): List<MapFile> {
        val maps = root.resolve(".archify")
        if (!maps.isDirectory()) return emptyList()
        val runs = try {
            Files.list(maps).use { stream -> stream.filter { it.isDirectory() }.toList() }
        } catch (e: IOException) {
            return emptyList()
        }
        return runs.map { MapFile(it.name, it.resolve("candidate.json")) }
            .filter { it.file.isRegularFile() }
            .sortedWith(compareBy<MapFile> { STAMP.find(it.run) == null }
                .thenByDescending { STAMP.find(it.run)?.groupValues?.get(1) ?: "" }
                .thenByDescending { STAMP.find(it.run)?.groupValues?.get(2)?.toIntOrNull() ?: 0 }
                .thenByDescending { modified(it.file) })
    }

    private fun modified(file: Path): Long = try {
        Files.getLastModifiedTime(file).toMillis()
    } catch (e: IOException) {
        0L
    }
}
