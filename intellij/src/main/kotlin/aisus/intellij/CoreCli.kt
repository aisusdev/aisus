// IDE-01: everything but the map and Generate goes through the core CLI, dist/cli/aisus.mjs, run by
// node with the repository as --root. These are its argument lists; the caller puts node in front.
package aisus.intellij

import com.google.gson.JsonParser
import java.nio.file.Path

object CoreCli {
    fun preflight(cli: Path, root: Path): List<String> = command(cli, root, "preflight", "--format", "markdown")

    fun install(cli: Path, root: Path, scope: String = "user"): List<String> = command(cli, root, "install", "--scope", scope, "--format", "markdown")

    fun check(cli: Path, root: Path, base: String): List<String> = command(cli, root, "check", "--base", base, "--format", "markdown")

    fun exportPage(cli: Path, root: Path, run: String): List<String> = command(cli, root, "export-page", "--map", run)

    /** The page export-page wrote, from its JSON output, or null. */
    fun writtenPage(root: Path, stdout: String): Path? = try {
        val result = JsonParser.parseString(stdout).asJsonObject
        val page = result.get("page")?.asString
        if (result.get("status")?.asString == "written" && page != null) SourcePaths.resolve(root, page) else null
    } catch (e: RuntimeException) {
        null
    }

    private fun command(cli: Path, root: Path, name: String, vararg options: String): List<String> =
        listOf(cli.toString(), name, "--root", root.toString(), *options)
}
