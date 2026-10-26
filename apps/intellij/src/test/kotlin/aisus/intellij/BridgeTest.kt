// IDE-01: the bridge reads the viewer's messages, builds the plugin's, and keeps a map's text inside
// its JSON so it cannot end the page's script.
package aisus.intellij

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeTest {
    private val map = """{"components":[{"id":"api","label":"API </script><script>alert(1)</script>","sources":[{"path":"src/api.ts","line":3,"end_line":9},{"path":"src/routes.ts"}]},{"id":"db","sources":[{"path":"src/db.ts","line":1}]}]}"""

    @Test
    fun `the viewer's ready and openSource are read, anything else is another message, and broken JSON is nothing`() {
        assertEquals(ViewerMessage.Ready, Bridge.parse("""{"type":"ready"}"""))
        assertEquals(ViewerMessage.OpenSource("api", 1), Bridge.parse("""{"type":"openSource","componentId":"api","index":1}"""))
        assertEquals(ViewerMessage.Other("tourStop"), Bridge.parse("""{"type":"tourStop","index":0}"""))
        assertNull(Bridge.parse("""{"type":"openSource","componentId":"api","index":-1}"""))
        assertNull(Bridge.parse("not json"))
        assertNull(Bridge.parse(null))
    }

    @Test
    fun `load carries the map as JSON with script tags escaped, and refuses a map that is not an object`() {
        val message = Bridge.load(map, "/repo/.aisus/maps/run/candidate.json")!!
        assertFalse(message.contains("</script"))
        val parsed = JsonParser.parseString(message).asJsonObject
        assertEquals("load", parsed.get("type").asString)
        assertEquals("/repo/.aisus/maps/run/candidate.json", parsed.get("file").asString)
        assertEquals("api", parsed.getAsJsonObject("doc").getAsJsonArray("components")[0].asJsonObject.get("id").asString)
        assertNull(Bridge.load("[1, 2]", "x"))
        assertNull(Bridge.load("}); alert(1); ({", "x"))
        assertEquals("window.aisusReceive && window.aisusReceive({\"a\":1});", Bridge.deliver("{\"a\":1}"))
    }

    @Test
    fun `a box's source is found by index, and the boxes citing a file are listed`() {
        assertEquals(SourceRef("src/api.ts", 3, 9), Bridge.source(map, "api", 0))
        assertEquals(SourceRef("src/routes.ts", null, null), Bridge.source(map, "api", 1))
        assertNull(Bridge.source(map, "api", 2))
        assertNull(Bridge.source(map, "missing", 0))
        assertEquals(listOf("db"), Bridge.boxesCiting(map, "src/db.ts"))
        val highlight = JsonParser.parseString(Bridge.highlight(listOf("db"), "src/db.ts")).asJsonObject
        assertEquals("highlight", highlight.get("type").asString)
        assertEquals("db", highlight.getAsJsonArray("ids")[0].asString)
        assertTrue(highlight.has("follow"))
    }
}
