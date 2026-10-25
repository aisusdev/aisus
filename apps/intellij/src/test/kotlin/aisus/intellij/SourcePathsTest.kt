// IDE-01: a citation opens only a file inside the repository, as the extension checks on every click.
package aisus.intellij

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files

class SourcePathsTest {
    @get:Rule
    val folder = TemporaryFolder()

    @Test
    fun `a repository-relative file resolves, and paths that leave the repository or do not exist do not`() {
        val root = folder.newFolder("repo").toPath()
        Files.createDirectories(root.resolve("src"))
        Files.writeString(root.resolve("src/api.ts"), "x")
        Files.writeString(folder.root.toPath().resolve("secret.txt"), "x")
        Files.createSymbolicLink(root.resolve("src/link.ts"), folder.root.toPath().resolve("secret.txt"))
        assertEquals(root.toRealPath().resolve("src/api.ts"), SourcePaths.resolve(root, "src/api.ts"))
        for (bad in listOf("../secret.txt", "/etc/hosts", "src/../../secret.txt", "src\\api.ts", "src//api.ts", "./src/api.ts", "", "src/link.ts", "src/missing.ts", "src")) {
            assertNull(bad, SourcePaths.resolve(root, bad))
        }
        assertEquals("src/api.ts", SourcePaths.relative(root, root.resolve("src/api.ts")))
        assertNull(SourcePaths.relative(root, folder.root.toPath().resolve("secret.txt")))
    }
}
