// IDE-01: the messages between the plugin and the map viewer (packages/viewer/hosts/jcef.ts). The viewer posts
// its messages as JSON through window.aisusPost, and the plugin answers by calling window.aisusReceive
// with a JSON object. Every message the plugin sends is built here and serialised by Gson, which escapes
// <, >, & and quotes, so a map's text cannot end the page's script.
package aisus.intellij

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/** A citation of code: a repository-relative path and an optional 1-based line range. */
data class SourceRef(val path: String, val line: Int?, val endLine: Int?)

/** What the map viewer asks of the plugin. */
sealed interface ViewerMessage {
    data object Ready : ViewerMessage
    data class OpenSource(val componentId: String, val index: Int) : ViewerMessage
    data class Other(val type: String) : ViewerMessage
}

object Bridge {
    private val gson = Gson()

    /** The viewer's message, or null when it is not one. */
    fun parse(json: String?): ViewerMessage? {
        val message = objectOf(json) ?: return null
        return when (val type = stringOf(message, "type")) {
            null -> null
            "ready" -> ViewerMessage.Ready
            "openSource" -> {
                val id = stringOf(message, "componentId")
                val index = intOf(message, "index")
                if (id != null && index != null && index >= 0) ViewerMessage.OpenSource(id, index) else null
            }
            else -> ViewerMessage.Other(type)
        }
    }

    /** The load message for the map in [docText] at [file], or null when the map is not a JSON object. */
    fun load(docText: String, file: String): String? {
        val doc = objectOf(docText) ?: return null
        val message = JsonObject()
        message.addProperty("type", "load")
        message.add("doc", doc)
        message.addProperty("file", file)
        return gson.toJson(message)
    }

    /** The viewer's empty state, with [text]. */
    fun empty(text: String): String {
        val message = JsonObject()
        message.addProperty("type", "empty")
        message.addProperty("message", text)
        return gson.toJson(message)
    }

    /** Marks the boxes [ids] as citing the repository-relative [file]. */
    fun highlight(ids: List<String>, file: String?): String {
        val message = JsonObject()
        message.addProperty("type", "highlight")
        message.add("ids", JsonArray().apply { ids.forEach { add(it) } })
        message.addProperty("file", file)
        message.addProperty("follow", false)
        return gson.toJson(message)
    }

    /** The script that hands [message], JSON built by this object, to the viewer. */
    fun deliver(message: String): String = "window.aisusReceive && window.aisusReceive($message);"

    /** Source [index] of box [componentId] in the map [docText], or null. */
    fun source(docText: String, componentId: String, index: Int): SourceRef? {
        val component = components(docText).firstOrNull { stringOf(it, "id") == componentId } ?: return null
        val sources = component.get("sources")?.takeIf { it.isJsonArray }?.asJsonArray ?: return null
        val entry = sources.elementAtOrNull(index)?.takeIf { it.isJsonObject }?.asJsonObject ?: return null
        val path = stringOf(entry, "path") ?: return null
        return SourceRef(path, intOf(entry, "line"), intOf(entry, "end_line"))
    }

    /** The ids of the boxes in [docText] that cite the repository-relative [path]. */
    fun boxesCiting(docText: String, path: String): List<String> =
        components(docText).filter { component ->
            val sources = component.get("sources")?.takeIf { it.isJsonArray }?.asJsonArray ?: return@filter false
            sources.any { it.isJsonObject && stringOf(it.asJsonObject, "path") == path }
        }.mapNotNull { stringOf(it, "id") }

    private fun components(docText: String): List<JsonObject> {
        val list = objectOf(docText)?.get("components")?.takeIf { it.isJsonArray }?.asJsonArray ?: return emptyList()
        return list.filter { it.isJsonObject }.map { it.asJsonObject }
    }

    private fun objectOf(text: String?): JsonObject? = try {
        if (text == null) null else JsonParser.parseString(text).takeIf { it.isJsonObject }?.asJsonObject
    } catch (e: RuntimeException) {
        null
    }

    private fun stringOf(json: JsonObject, key: String): String? =
        json.get(key)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString

    private fun intOf(json: JsonObject, key: String): Int? {
        val value: JsonElement = json.get(key)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber } ?: return null
        val number = value.asDouble
        return if (number % 1.0 == 0.0 && number in 0.0..Int.MAX_VALUE.toDouble()) number.toInt() else null
    }
}
