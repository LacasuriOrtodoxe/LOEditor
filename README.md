# LOEditor

A **lightweight, extensible, and customizable** WYSIWYG (What You See Is What You Get) HTML editor with clean output and an easy-to-use JavaScript API. Built with **vanilla JavaScript and jQuery**, LOEditor avoids the deprecated `document.execCommand()` and provides a modern, plugin-based architecture for seamless integration into web applications.

---

## ✨ Key Features

- **Stable**: No unexpected behaviour.
- **Lightweight**: Minimal dependencies (only jQuery).
- **Extensible**: Plugin-based architecture for adding custom functionality.
- **Customizable**: Configure the toolbar and the styles.
- **Clean Output**: Automatically sanitizes HTML to prevent invalid markup and unnecessary code.
- **No `execCommand`**: Avoids the deprecated and unstable `document.execCommand`.
- **Progressive Enhancement**: Works with standard `<textarea>` elements for backend compatibility.
- **Scoped Styles**: Plugin styles are automatically scoped to the editor instance to avoid CSS conflicts.
- **Beginner-Friendly**: Simple and intuitive API, making it easy for beginners to extend.

---

## 🌐 Demo

Test LOEditor live on our official webpage:  
🔗 [LOEditor Demo](https://lacasuriortodoxe.ro/academia/open-source/loeditor/)

More open-source projects:
🔗 [Open Source projects](https://lacasuriortodoxe.ro/academia/open-source/)

---

## 🙏 Supporters

We are grateful to our supporters:

- **[NETCreator Hosting](https://netcreator.us)** and **[NETCreator Regio](http://regio.netcreator.us)**, two web hosting companies providing free and paid hosting in multiple locations.

---

## 🚀 Getting Started

### Installation

1. **Include the required files** in your webpage:
  ```html
   <script src="https://cdn.jsdelivr.net/gh/jquery/jquery@latest/dist/jquery.min.js"></script>
   <script src="https://cdn.jsdelivr.net/gh/LacasuriOrtodoxe/LOEditor@latest/loeditor.min.js"></script>
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/LacasuriOrtodoxe/LOEditor@latest/loeditor.min.css"/>
  ```
2. **Replace a `<textarea>`** with the editor:
  ```html
   <textarea id="example">Some text...</textarea>
   <script>
     var textarea = document.querySelector("#example");
     var editor = new LOEditor(textarea);
   </script>
  ```
3. **Replace all textareas by class name**:
  ```html
   <textarea class="editor">Some text 1...</textarea>
   <textarea class="editor">Some text 2...</textarea>
   <script>
     var textareas = document.querySelectorAll(".editor");
     for (let i = 0; i < textareas.length; i++) {
       new LOEditor(textareas[i], {
         upload: "upload-url"
       });
     }
   </script>
  ```

---

## 📜 Philosophy

LOEditor is designed to produce **clean HTML5 output** using classical HTML semantics. Technically, it leverages the `contenteditable` feature of modern browsers but addresses its unexpected behaviors by:

- Using **`<p>` tags as the root block** for all content (other block types are disallowed).
- Allowing **custom class names** for root `<p>` tags to represent different styles (e.g., `blockquote`).
- Converting **each editor action** (e.g., bold, italic, align-left, blockquote) into a plugin.
- Using **custom HTML semantics for child tags** (e.g., `<lo-b>`, `<lo-i>`) during editing to ensure consistency.
- Preventing **nested child tags of the same type** (e.g., `<lo-b>` cannot contain another `<lo-b>`).

LOEditor recreates essential functionalities from scratch, replacing the unstable `document.execCommand()`.

**Important:** The exported contents will use classical HTML5 semantics, so you don’t need to worry about using different semantics while editing.

---

## ⚙️ Configuration

### Settings Object

The `LOEditor` constructor accepts a **settings object** with the following properties:


| Property  | Type                | Description                                                                | Default Value                                                                                                       |
| --------- | ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `toolbar` | `string` or `array` | List of plugin names to display in the toolbar (space-separated or array). | `"heading bold italic code mark link blockquote pre left center right img separator lo-up lo-down lo-del lo-clean"` |
| `plugins` | `array`             | Array of custom plugins to load.                                           | `[]`                                                                                                                |
| `upload`  | `string`            | URL for uploading images (used by the `img` plugin).                       | `null`                                                                                                              |


**Note:** Each plugin may require additional settings. Refer to the [Plugin Documentation](#plugin-architecture) for details.

### Example Configuration

```javascript
new LOEditor(textarea, {
  toolbar: "bold italic link img",
  upload: "/api/upload",
  plugins: [customPlugin]
});
```

---

## 🧩 Plugin Architecture

### What is a Plugin?

A plugin is an object that extends LOEditor's functionality. Plugins can:

- Add new buttons to the toolbar.
- Define custom styles and actions.
- Handle saving/loading content.
- Add event listeners.

### Plugin Structure

A plugin is an object with the following properties:


| Property | Type       | Description                                                                                              |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `name`   | `string`   | Unique identifier for the plugin (used in the toolbar).                                                  |
| `type`   | `string`   | Type of plugin: `"textblock"`, `"child"`, or `"block"`.                                                  |
| `button` | `string`   | HTML for the toolbar button (e.g., `<button>...</button>`).                                              |
| `style`  | `string`   | CSS styles for the plugin (scoped to the editor).                                                        |
| `action` | `function` | Function called when the button is clicked. Receives `(event, editor)` arguments.                        |
| `save`   | `function` | Function to convert plugin-specific markup to standard HTML during save. Receives `(container, editor)`. |
| `load`   | `function` | Function to convert standard HTML to plugin-specific markup during load. Receives `(container, editor)`. |
| `events` | `function` | Function to bind event listeners to the editor. Receives `(editor)`.                                     |
| `allow`  | `array`    | List of allowed HTML tags for the plugin (e.g., `["lo-b"]`).                                             |


**Note:** The `container` passed to methods represents the DOM HTML object of the editor container. The `editor` parameter is a reference to the LOEditor class instance.

---

## 🔌 API Methods

### Core Methods

#### `constructor(textarea, settings)`

- **Description**: Initializes the editor on the given `<textarea>`.
- **Parameters**:
  - `textarea`: The `<textarea>` element to replace with the editor.
  - `settings`: Configuration object (optional).

#### `addPlugin(plugin)`

- **Description**: Registers a new plugin with the editor.
- **Parameters**:
  - `plugin`: Plugin object (see [Plugin Structure](#plugin-structure)).

#### `toggleSelection(type)`

- **Description**: Toggles a formatting tag (e.g., bold, italic) on the current selection.
- **Parameters**:
  - `type`: The tag name (e.g., `"lo-b"` for bold).
- **Returns**: Array of wrapped elements.

#### `toggleBlock(type)`

- **Description**: Toggles a block-level class (e.g., heading, blockquote) on the current paragraph.
- **Parameters**:
  - `type`: The class name (e.g., `"lo-heading"`).

#### `getSelection()`

- **Description**: Returns an array of objects representing the current text selection.
- **Returns**: Array of selection parts (each with `node`, `parentElement`, `textPart`, `startOffset`, `endOffset`).

#### `getCurrentParagraph()`

- **Description**: Returns the current paragraph element (`<p>`) containing the cursor.
- **Returns**: DOM element.

#### `save()`

- **Description**: Converts the editor's content to HTML and updates the original `<textarea>`.

#### `load()`

- **Description**: Loads HTML from the `<textarea>` into the editor after converting it to LOEditor-specific syntax.

#### `sanitizeEditor()`

- **Description**: Cleans up the editor's HTML to ensure clean markup.

#### `sanitizeText(text)`

- **Description**: Sanitizes text (e.g., from paste events) to convert it into clean HTML.
- **Parameters**:
  - `text`: The text to sanitize.
- **Returns**: Sanitized HTML string.

#### `makeMovable(el)`

- **Description**: Makes an element movable (used by default for images/separators).
- **Parameters**:
  - `el`: The DOM element to make movable.

#### `moveUp()`

- **Description**: Moves the currently selected movable element up.

#### `moveDown()`

- **Description**: Moves the currently selected movable element down.

#### `del()`

- **Description**: Deletes the currently selected movable element.

---

## 📌 Default Plugins

LOEditor includes the following built-in plugins:


| Plugin Name  | Type        | Description                                                                  | Toolbar Button |
| ------------ | ----------- | ---------------------------------------------------------------------------- | -------------- |
| `heading`    | `textblock` | Adds a heading style to paragraphs.                                          | ✅              |
| `bold`       | `child`     | Wraps selection in `<lo-b>` (converts to `<b>` on save).                     | ✅              |
| `italic`     | `child`     | Wraps selection in `<lo-i>` (converts to `<i>` on save).                     | ✅              |
| `code`       | `child`     | Wraps selection in `<lo-code>` (converts to `<code>` on save).               | ✅              |
| `mark`       | `child`     | Wraps selection in `<lo-mark>` (converts to `<mark>` on save).               | ✅              |
| `link`       | `child`     | Wraps selection in `<lo-link>` (converts to `<a>` on save). Prompts for URL. | ✅              |
| `blockquote` | `textblock` | Wraps paragraph in `<lo-blockquote>` (converts to `<blockquote>` on save).   | ✅              |
| `pre`        | `textblock` | Wraps paragraph in `<lo-pre>` (converts to `<pre>` on save).                 | ✅              |
| `left`       | `textblock` | Aligns paragraph to the left.                                                | ✅              |
| `center`     | `textblock` | Aligns paragraph to the center.                                              | ✅              |
| `right`      | `textblock` | Aligns paragraph to the right.                                               | ✅              |
| `img`        | `block`     | Inserts an image (requires `upload` URL in settings).                        | ✅              |
| `separator`  | `block`     | Inserts a horizontal rule (`<hr>`).                                          | ✅              |
| `lo-up`      | `block`     | Moves the selected block up.                                                 | ✅              |
| `lo-down`    | `block`     | Moves the selected block down.                                               | ✅              |
| `lo-del`     | `block`     | Deletes the selected block.                                                  | ✅              |
| `lo-clean`   | `block`     | Removes empty paragraphs.                                                    | ✅              |


---

## 🛠️ Creating a Plugin

### Step-by-Step Guide

#### 1. Define the Plugin Object

Create an object with the required properties:

```javascript
const customPlugin = {
  name: 'custom-button',
  type: 'child', // or 'textblock' or 'block'
  button: '<button type="button"><svg>...</svg></button>',
  style: `
    lo-custom {
      color: blue;
      font-weight: bold;
    }
  `,
  action: function(event, editor) {
    // Toggle custom formatting
    editor.toggleSelection('lo-custom');
  },
  save: function(container, editor) {
    // Convert to standard HTML
    $(container).find('lo-custom').each(function() {
      $(this).replaceWith('<span class="custom">' + $(this).html() + '</span>');
    });
  },
  load: function(container, editor) {
    // Convert from standard HTML
    $(container).find('span.custom').each(function() {
      $(this).replaceWith('<lo-custom>' + $(this).html() + '</lo-custom>');
    });
  }
};
```

#### 2. Register the Plugin

Pass the plugin to the editor during initialization:

```javascript
new LOEditor(textarea, {
  plugins: [customPlugin],
  toolbar: "bold italic custom-button"
});
```

---

## 📝 Examples

### Example 1: Custom Plugin for Underline

```javascript
const underlinePlugin = {
  name: 'underline',
  type: 'child',
  allow: ['lo-u'],
  style: `
    lo-u {
      text-decoration: underline;
    }
  `,
  button: `<button type="button">U</button>`,
  action: function(event, editor) {
    editor.toggleSelection('lo-u');
  },
  save: function(container) {
    $(container).find('lo-u').each(function() {
      $(this).replaceWith('<u>' + $(this).html() + '</u>');
    });
  },
  load: function(container) {
    $(container).find('u').each(function() {
      $(this).replaceWith('<lo-u>' + $(this).html() + '</lo-u>');
    });
  }
};

new LOEditor(textarea, {
  plugins: [underlinePlugin],
  toolbar: "bold italic underline"
});
```

### Example 2: Custom Block Plugin for Alerts

```javascript
const alertPlugin = {
  name: 'alert',
  type: 'textblock',
  style: `
    .lo-alert {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 10px;
      border-radius: 5px;
    }
  `,
  button: `<button type="button">Alert</button>`,
  action: function(event, editor) {
    editor.toggleBlock('lo-alert');
  },
  save: function(container) {
    $(container).find('.lo-alert').each(function() {
      $(this).replaceWith('<div class="alert">' + $(this).html() + '</div>');
    });
  },
  load: function(container) {
    $(container).find('div.alert').each(function() {
      $(this).replaceWith('<p class="lo-alert">' + $(this).html() + '</p>');
    });
  }
};

new LOEditor(textarea, {
  plugins: [alertPlugin],
  toolbar: "bold italic alert"
});
```

---

## 🤝 Contributing

### How to Contribute

1. **Develop a Plugin**: Write a new plugin or improve an existing one.
2. **Submit a Pull Request**: Share your changes with the community.

### Guidelines

- Follow the existing plugin structure.
- Ensure your plugin handles both `save` and `load` methods for compatibility.
- Test your plugin with different selections (empty, partial, full).
