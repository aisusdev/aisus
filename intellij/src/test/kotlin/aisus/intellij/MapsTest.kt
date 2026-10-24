// IDE-01: the maps are listed newest first, as the extension lists them.
package aisus.intellij

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.attribute.FileTime

class MapsTest {
    @get:Rule
    val folder = TemporaryFolder()

    @Test
    fun `timestamped runs come first, newest and highest counter first, then the rest by modification time, and folders without a candidate are left out`() {
        val root = folder.root.toPath()
        fun run(name: String, minutes: Long = 0, candidate: Boolean = true) {
            val dir = Files.createDirectories(root.resolve(".archify/$name"))
            if (candidate) {
                val file = Files.writeString(dir.resolve("candidate.json"), "{}")
                Files.setLastModifiedTime(file, FileTime.fromMillis(1_700_000_000_000 + minutes * 60_000))
            }
        }
        run("architecture-shop-20261018-120000")
        // The counter decides between runs of the same second, even against the modification time.
        run("architecture-shop-20261019-090000", minutes = 10)
        run("architecture-shop-20261019-090000-2", minutes = 0)
        run("handmade", minutes = 5)
        run("older-handmade", minutes = 1)
        run("architecture-shop-20261020-080000", candidate = false)
        assertEquals(
            listOf("architecture-shop-20261019-090000-2", "architecture-shop-20261019-090000", "architecture-shop-20261018-120000", "handmade", "older-handmade"),
            Maps.list(root).map { it.run },
        )
        assertEquals(emptyList<MapFile>(), Maps.list(folder.newFolder("empty").toPath()))
    }
}
