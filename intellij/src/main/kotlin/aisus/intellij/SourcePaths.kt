// IDE-01: a map's citations are opened only inside the repository. A path is repository-relative with
// "/" separators and no "." or ".." segments, and its real path, links resolved, stays inside the
// repository's real path, as the extension checks on every click.
package aisus.intellij

import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

object SourcePaths {
    private val SEGMENT = Regex("""[^/\\:]+""")

    /** The file [path] names inside [root], or null when it leaves the repository or does not exist. */
    fun resolve(root: Path, path: String): Path? {
        val segments = path.split("/")
        if (path.isEmpty() || path.startsWith("/") || segments.any { it.isEmpty() || it == "." || it == ".." || !SEGMENT.matches(it) }) return null
        return try {
            val realRoot = root.toRealPath()
            val real = realRoot.resolve(path).toRealPath()
            if (real.startsWith(realRoot) && real != realRoot && Files.isRegularFile(real)) real else null
        } catch (e: IOException) {
            null
        }
    }

    /** [file] relative to [root] with "/" separators, or null when it lies outside. */
    fun relative(root: Path, file: Path): String? {
        val relative = root.toAbsolutePath().normalize().relativize(file.toAbsolutePath().normalize())
        if (relative.toString().isEmpty() || relative.startsWith("..")) return null
        return relative.joinToString("/")
    }
}
