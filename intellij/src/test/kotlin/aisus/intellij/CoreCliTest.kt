// IDE-01: the core CLI's calls: each command with the repository as --root, and export-page's answer.
package aisus.intellij

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class CoreCliTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val cli = Path.of("/core/dist/cli/aisus.mjs")
    private val root = Path.of("/work/shop")

    @Test
    fun `each command runs the CLI with the repository as root`() {
        assertEquals(listOf("/core/dist/cli/aisus.mjs", "preflight", "--root", "/work/shop", "--format", "markdown"), CoreCli.preflight(cli, root))
        assertEquals(listOf("/core/dist/cli/aisus.mjs", "install", "--root", "/work/shop", "--scope", "user", "--format", "markdown"), CoreCli.install(cli, root))
        assertEquals(listOf("/core/dist/cli/aisus.mjs", "check", "--root", "/work/shop", "--base", "origin/main", "--format", "markdown"), CoreCli.check(cli, root, "origin/main"))
        assertEquals(listOf("/core/dist/cli/aisus.mjs", "export-page", "--root", "/work/shop", "--map", "architecture-shop-20261019-090000"), CoreCli.exportPage(cli, root, "architecture-shop-20261019-090000"))
    }

    @Test
    fun `export-page's written page is found inside the repository, and anything else is not`() {
        val repo = folder.newFolder("repo").toPath()
        Files.createDirectories(repo.resolve(".archify/run"))
        Files.writeString(repo.resolve(".archify/run/diagram.html"), "<html>")
        assertEquals(repo.toRealPath().resolve(".archify/run/diagram.html"), CoreCli.writtenPage(repo, """{"status":"written","page":".archify/run/diagram.html"}"""))
        assertNull(CoreCli.writtenPage(repo, """{"status":"written","page":"../outside.html"}"""))
        assertNull(CoreCli.writtenPage(repo, """{"status":"error"}"""))
        assertNull(CoreCli.writtenPage(repo, "usage: aisus.mjs"))
    }

    @Test
    fun `the bundled core unpacks in place, and an entry that would land outside its folder is refused`() {
        fun zip(vararg entries: Pair<String, String>): ByteArrayInputStream {
            val bytes = ByteArrayOutputStream()
            ZipOutputStream(bytes).use { out -> entries.forEach { (name, text) -> out.putNextEntry(ZipEntry(name)); out.write(text.toByteArray()); out.closeEntry() } }
            return ByteArrayInputStream(bytes.toByteArray())
        }
        val target = folder.root.toPath().resolve("core")
        AisusCore.unpack(zip("dist/cli/aisus.mjs" to "cli", "viewer/jcef.js" to "viewer"), target)
        assertEquals("cli", Files.readString(target.resolve("dist/cli/aisus.mjs")))
        try {
            AisusCore.unpack(zip("../escape.txt" to "x"), folder.root.toPath().resolve("other"))
            throw AssertionError("an entry outside the folder was unpacked")
        } catch (e: IOException) {
            assertEquals(false, Files.exists(folder.root.toPath().resolve("escape.txt")))
        }
    }
}
