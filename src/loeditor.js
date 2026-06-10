class LOEditor {
    
    // Main constructor
    constructor(textarea, settings = null) {
        
        // Initialize
        this.id         = "lo-editor-" + crypto.randomUUID();
        this.container  = $('<div id="' + this.id + '"></div>');
        this.toolbar    = $('<lo-toolbar></lo-toolbar>');
        this.editor     = $('<lo-editor contenteditable="true" spellcheck="false"></lo-editor>');
        this.crtMove    = null;
        this.crtImg     = null;
        this.textarea   = $(textarea);
        this.plugins    = [];
        this.stylesheet = "";
        this.settings   = settings;
        
        // Toolbar builder
        if(settings != null && typeof(settings.toolbar) !== "undefined") {
            this.buttonList = settings.toolbar;
        } else {
            this.buttonList = "heading bold italic code mark link blockquote pre left center right img separator lo-up lo-down lo-del lo-clean";
        }
        
        // Generate the editor
        this.textarea.hide();
        this.container.insertBefore(this.textarea);
        this.toolbar.appendTo(this.container);
        this.editor.appendTo(this.container);
        this.defaultPlugins();
        
        // Load additional plugins
        if(settings != null && typeof(settings.plugins) !== "undefined") {
            for(let i=0;i<settings.plugins.length;i++) {
                this.addPlugin(settings.plugins[i]);
            }
        }
        
        // Show toolbar
        this.addButtons();
        
        // Load stylesheet for plugins
        for(let i=0;i<this.plugins.length;i++) {
            if(typeof(this.plugins[i].style) !== "undefined") {
                let the_stylesheet_lines = this.plugins[i].style.split("\n");
                for(let j=0;j<the_stylesheet_lines.length;j++) {
                    if(the_stylesheet_lines[j].trim().endsWith('{') && !the_stylesheet_lines[j].trim().startsWith('@')) {
                        this.stylesheet += "#" + this.id + " " + the_stylesheet_lines[j].trim() + "\n";
                    } else {
                        this.stylesheet += the_stylesheet_lines[j].trim() + "\n";
                    }
                }
            }
        }
        this.stylesheet = $('<style>', {
            type: 'text/css',
            text: this.stylesheet
        }).appendTo(this.toolbar);
        
        // Load editor data
        this.load();
        
        // Plugins events
        for(let i=0;i<this.plugins.length;i++) {
            if(typeof(this.plugins[i].events) !== "undefined") {
                this.plugins[i].events(this);
            }
        }
        
        // Movable elements and images
        $(document).click(() => {
            this.crtMove = null;
            this.crtImg  = null;
            $(".lo-button-up").hide();
            $(".lo-button-down").hide();
            $(".lo-button-delete").hide();
        });
        
        // On paste
        $(this.editor).on('paste', (e) => {
            e.preventDefault();
            e.stopPropagation();
            var text;
            var clp = (e.originalEvent || e).clipboardData;
            if (clp === undefined || clp === null) {
                text = window.clipboardData.getData("text") || "";
            } else {
                text = clp.getData('text/plain') || "";
            }
            text = this.sanitizeText(text);
            if(text.includes('<p>')) {
                var crt = this.getCurrentParagraph();
                $(text).insertAfter(crt);
            } else {
                const selection = window.getSelection();
                if (!selection.rangeCount) return;
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
        
        // On drag start
        $(this.editor).on('dragstart', (e) => {
            e.originalEvent.dataTransfer.setData('text/html', '<p>' + window.getSelection().toString() + '</p>');
        });
        
        // On drag end what to be added
        $(this.editor).on('dragend', (e) => {
            setTimeout(() => {
                this.sanitizeEditor();
            }, 10);
        });
        
        // On enter, delete or backspace, sanitize editor
        $(this.editor).on('keydown', (e) => {
            if(e.key === 'Enter' || e.keyCode === 13 || e.key == 'Backspace' || e.keyCode !== 8 || e.key === 'Delete' || e.keyCode === 46) {
                setTimeout(() => {
                    this.sanitizeEditor();
                }, 100);
            }
            // On delete image, remove image
            if(e.keyCode == 8 || e.keyCode == 46) {
                if(this.crtImg !== null) {
                    $(this.crtImg).remove();
                }
            }
        });
        
        // Autosave to textarea
        setInterval(() => { this.save() }, 1000);
        
    }
    
    // Get current selection parts
    getSelection() {
        
        // Get selection
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return [];
    
        // Get selected range
        const range = selection.getRangeAt(0);
        const result = [];
    
        // Get start and end parts of selection
        const startNode = range.startContainer;
        const startOffset = range.startOffset;
        const endNode = range.endContainer;
        const endOffset = range.endOffset;
    
        // Get each text node with walker
        // Source: https://dev.to/boonecabal/how-to-rapidly-build-browser-extensions-with-ai-1ml6
        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (range.intersectsNode(node)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );
    
        // Verify if first node is Text Node and if it is inside selection range
        let currentNode = walker.currentNode;
        if(currentNode.nodeType === Node.TEXT_NODE && range.intersectsNode(currentNode)) {
            processNode(currentNode);
        }
    
        // Then we process each node
        while(walker.nextNode()) {
            processNode(walker.currentNode);
        }
        
        // Process node
        function processNode(node) {
            let from = 0;
            let to = node.length;
            let selectedText = node.textContent.substring(from, to);
            if (node === startNode) {
                from = startOffset;
            }
            if (node === endNode) {
                to = endOffset;
            }
            result.push({
                node: node,
                parentElement: node.parentElement,
                textPart: selectedText,
                startOffset: from,
                endOffset: to
            });
        }
    
        return result;
    }
    
    // Get current paragraph
    getCurrentParagraph() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        var el = range.startContainer;
        while($(el).prop("tagName") != 'P' && $(el).hasParent()) {
            el = $(el).parent();
        }
        return el;
    }
    
    // Unwrap element
    // Source: https://dev.to/btopro/simple-wrap-unwrap-methods-explained-3k5f
    unwrap(el) {
        if(el && el.parentNode) {
            while (el.firstChild) {
                el.parentNode.insertBefore(el.firstChild, el);
            }
            el.remove();
        }
    }
    
    // Wrap element
    // Partial source: https://dev.to/btopro/simple-wrap-unwrap-methods-explained-3k5f
    wrap(el, wrapper) {
        var tag = null;
        if(typeof(wrapper) == "string") {
            tag = document.createElement(wrapper);
        } else {
            tag = wrapper;
        }
        if(el && el.parentNode) {
            el.parentNode.insertBefore(tag, el);
            tag.appendChild(el);
            return tag;
        }
    }
    
    // Clean text nodes - transform into single text node
    clean() {
        $(this.editor).find('p').each(function() {
            if (this.nodeType === Node.ELEMENT_NODE) {
                this.normalize();
            } else if (this.parentNode) {
                this.parentNode.normalize();
            }
        });
    }
    
    // Is just cursor, ie: empty selection
    isSelectionEmpty() {
        const selection = window.getSelection();
        if(!selection.rangeCount) return;
        if(typeof selection.isCollapsed === 'boolean') return selection.rangeCount === 0 || selection.isCollapsed;
        return true;
    }
    
    // Toggle selection tag
    toggleSelection(type) {
        
        // Get current selections
        const parts = this.getSelection();
        if(!parts || parts.length === 0) return;
        
        // Check if already contains a $type element
        let unwrap = false;
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            const node = part.node;
            let targetNode = node;

            // If part is empty (nothing selected, but wrongly passed)
            if(part.textPart.length === 0) continue;
    
            // Set unwrap if it is already $type
            if(node.parentElement.closest(type)) {
                unwrap = true;
                break;
            }
        }
        
        // Array of elements to return
        let returns = [];
    
        // Each part
        for(let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            const node = part.node;
            let targetNode = node;
    
            // If part is empty (nothing selected, but wrongly passed)
            if(part.textPart.length === 0) continue;
    
            // Unwrap part if it is already $type
            if(node.parentElement.closest(type) && unwrap == true) {
                
                // Remove $type
                this.unwrap(node.parentElement.closest(type));
                
            // Else make it $type
            } else if(unwrap == false) {
    
                // If not completely selected, split it from the end
                if(part.endOffset < node.length) {
                    node.splitText(part.endOffset);
                }
        
                // I not completely selected, split if from beginning
                if(part.startOffset > 0) {
                    targetNode = node.splitText(part.startOffset);
                }
        
                // Replace element with the new tag
                returns.push(this.wrap(targetNode, type));
                
            }
        }
    
        // Clean text nodes
        this.clean();
    
        return returns;
        
    }

    
    // Toggle Block Type
    toggleBlock(type) {
        
        // Get current selection
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        // Get selected range
        const range = selection.getRangeAt(0);
        
        // Disallowed blocks to toggle
        let disallowed = [];
        for(var i=0;i<this.plugins.length;i++) {
            if(this.plugins[i].type == 'block') {
                disallowed.push('lo-' + this.plugins[i].name);
            }
        }
        
        // If selection is empty, get current clicked block
        if(this.isSelectionEmpty()) {
            var p = this.getCurrentParagraph();
            if($(p).hasClass('lo-img') || $(p).hasClass('lo-separator')) return;
            if($(p).hasClass(type)) {
                $(p).removeClass();
            } else {
                $(p).removeClass();
                $(p).addClass(type);
            }
        
        // If a single block is selected
        } else if($(range.commonAncestorContainer).parent().prop('tagName').toLowerCase() == 'p') {
            if(disallowed.some(r => $(range.commonAncestorContainer).parent().prop('class').split(' ').includes(r))) return;
            if($(range.commonAncestorContainer).parent().hasClass(type)) {
                $(range.commonAncestorContainer).parent().removeClass();
            } else {
                $(range.commonAncestorContainer).parent().removeClass();
                $(range.commonAncestorContainer).parent().addClass(type);
            }
            
        // If multiple blocks are selected
        } else {
            let ps = $(range.commonAncestorContainer).parent().find("p");
            let pss = Array.from(ps).filter(p => {
                if (!selection.containsNode(p, true)) return false;
                let pRange = document.createRange();
                pRange.selectNodeContents(p);
                return range.compareBoundaryPoints(Range.END_TO_START, pRange) < 0 &&
                       range.compareBoundaryPoints(Range.START_TO_END, pRange) > 0;
            });
            pss.forEach((el) => {
                if(disallowed.some(r => $(el).prop('class').split(' ').includes(r))) return;
                if($(el).hasClass(type)) {
                    $(el).removeClass();
                } else {
                    $(el).removeClass();
                    $(el).addClass(type);
                }
            });
        }
        
    }
    
    // Sanitize editor's content
    sanitizeEditor() {
        var allowed = [];
        var allowedin = ['br'];
        const self = this;
        for(var i=0;i<this.plugins.length;i++) {
            if(this.plugins[i].type == 'block' || this.plugins[i].type == 'textblock') {
                allowed.push('lo-' + this.plugins[i].name);
            }
            if(typeof(this.plugins[i].allow) !== "undefined") {
                $.merge(allowedin, this.plugins[i].allow);
            }
        }
        $(this.editor).find("> *").each(function() {
            if($(this).prop('tagName').toLowerCase() != 'p') {
                $(this).replaceWith('<p>' + $(this).text() + '</p>');
            }
        });
        $(this.editor).find("p").each(function() {
            if(typeof($(this).prop('class')) !== "undefined" && $(this).prop('class').trim() != "" && !allowed.includes($(this).prop('class').toLowerCase().trim())) {
                $(this).replaceWith('<p>' + $(this).text() + '</p>');
            }
        });
        $(this.editor).find("p *").each(function() {
            if(typeof($(this).prop('tagName')) !== "undefined" && $(this).prop('tagName').trim() != "" && !allowedin.includes($(this).prop('tagName').toLowerCase().trim())) {
                $(this).replaceWith(document.createTextNode($(this).text()));
            }
        });
    }
    
    // Delete
    del() {
        this.crtMove.remove();
    }
    
    // Move up
    moveUp() {
        if(this.crtMove.previousElementSibling)
            this.crtMove.parentNode.insertBefore(this.crtMove, this.crtMove.previousElementSibling);
    }
    
    // Move down
    moveDown() {
        if(this.crtMove.nextElementSibling)
            this.crtMove.parentNode.insertBefore(this.crtMove.nextElementSibling, this.crtMove);
    }
    
    // Make Movable
    makeMovable(el) {
        this.crtMove = el;
        $("button.lo-button-up").show();
        $("button.lo-button-down").show();
        $("button.lo-button-delete").show();
    }
    
    // Sanitize Text
    sanitizeText(text) {
        text = text.replace(/<[^>]*>/g, "");
        text = text.split("\n");
        if(text.length == 1) {
            return text[0];
        } else {
            for(var i=0;i<text.length;i++) {
                if(text[i].trim() == "") {
                    text[i] = "";
                } else {
                    text[i] = "<p>" + text[i] + "</p>";
                }
            }
            return text.join('');
        }
    }

    // Convert to HTML
    save() {
        
        // Clone editor contents
        var container = $(this.editor).clone();
        
        // Only p root
        $(container).find('> *').each(function() {
            if($(this).prop('tagName').toLowerCase() != 'p') {
                $(this).replaceWith('<p>' + $(this).html() + '</p>');
            }
        });
        
        // Do plugins
        this.plugins.forEach((plugin) => {
            if(typeof(plugin.save) !== "undefined") {
                plugin.save(container, this);
            }
        });
        
        // Add data to the textarea
        $(this.textarea).val($(container).html());
        
    }

    // Load HTML
    load() {
        
        // Clone the HTML from textarea
        var container = $('<div>').html($(this.textarea).val());
        
        // Transform any text node into p
        container.contents().filter(function(){ return this.nodeType === 3 && $.trim(this.nodeValue); }).replaceWith(function(){ return $('<p>').html(this.nodeValue); });
        
        // Do plugins
        this.plugins.forEach((plugin) => {
            if(typeof(plugin.load) !== "undefined") {
                plugin.load(container, this);
            }
        });
        
        // Only p tags allowed at root
        container.find('> *').each(function() {
            if($(this).prop('tagName').toLowerCase() != 'p') {
                $(this).replaceWith('<p>' + $(this).clone().wrap('<p>').parent().html() + '</p>');
            }
        });
        
        // Disable attributes like style, width and height
        container.find('*').each(function() {
            $(this).removeAttr("style");
            $(this).removeAttr("width", "");
            $(this).removeAttr("height", "");
        });
        
        
        // If empty container, force p root element
        if(container.html() == "") {
            container.html('<p>&nbsp;</p>');
        }
        
        // Append data to editor
        $(this.editor).append(container.html());
        
        // Sanitize Editor
        this.sanitizeEditor();
        
    }

    // Show buttons
    addButtons() {
        this.buttonList = this.buttonList.split(" ");
        this.buttonList.forEach((name) => {
            this.plugins.forEach((plugin) => {
                if(plugin.name == name) {
                    let el = $(plugin.button);
                    $(this.toolbar).append(el);
                    el.click((e) => { plugin.action(e, this); }); 
                }
            });
        });
    }

    // Register plugins
    addPlugin(plugin) {
        this.plugins.push(plugin);
    }
    
    // Create all default plugins
    defaultPlugins() {
        
        this.addPlugin({
            name: 'heading',
            type: 'textblock',
            style:  `.lo-heading {
                font-size: 28px;
                font-weight: bold;
                margin-top: 30px;
            }`,
            button: `<button type="button" class="lo-button-images"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M11.385 6.25h-4.75q-.257 0-.436-.18q-.18-.18-.18-.438q0-.257.18-.444T6.635 5h10.75q.256 0 .436.18q.179.18.179.438q0 .257-.18.444t-.435.188h-4.75v12.135q0 .256-.18.436q-.18.179-.438.179q-.257 0-.445-.185q-.187-.185-.187-.45z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleBlock('lo-heading');
            },
            save: (container) => {
                $(container).find('.lo-heading').each(function() {
                    $(this).replaceWith('<h2>' + $(this).html() + '</h2>');
                });
            },
            load: (container) => {
                $(container).find('h2,h1,h3,h4').each(function() {
                    $(this).replaceWith('<p class="lo-heading">' + $(this).html() + '</p>');
                });
            }
            
        });
        
        this.addPlugin({
            name: 'bold',
            type: 'child',
            allow: ['lo-b'],
            style:  `lo-b {
                font-weight: bold;
            }`,
            button: `<button type="button" class="lo-button-bold">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M8.916 18.25q-.441 0-.74-.299t-.299-.74V6.79q0-.441.299-.74t.74-.299h3.159q1.433 0 2.529.904T15.7 9.006q0 .967-.508 1.693t-1.257 1.065q.913.255 1.55 1.073t.638 1.97q0 1.61-1.202 2.527q-1.202.916-2.646.916zm.236-1.184h3.062q1.161 0 1.875-.7q.715-.699.715-1.627q0-.93-.714-1.629q-.715-.698-1.894-.698H9.152zm0-5.816h2.864q.997 0 1.69-.617t.692-1.546q0-.947-.704-1.553q-.704-.605-1.667-.605H9.152z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleSelection('lo-b');
            },
            save: (container) => {
                $(container).find('lo-b').each(function() {
                    $(this).replaceWith($('<b>' + $(this).html() + '</b>'));
                });
            },
            load: (container) => {
                $(container).find('b,strong').each(function() {
                    $(this).replaceWith('<lo-b>' + $(this).html() + '</lo-b>');
                });
            }
        });
        
        this.addPlugin({
            name: 'italic',
            type: 'child',
            style:  `lo-i {
                font-style: italic;
            }`,
            allow: ['lo-i'],
            button: `<button type="button" class="lo-button-italic"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M6.346 18.25q-.234 0-.396-.162t-.161-.397t.161-.396t.396-.16h3.077l3.48-10.27H9.828q-.234 0-.396-.162t-.162-.397t.162-.395t.396-.161h7.192q.235 0 .396.162t.162.397t-.162.396q-.161.16-.396.16h-2.961l-3.481 10.27h2.962q.234 0 .395.162t.162.397t-.162.396t-.395.16z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleSelection('lo-i');
            },
            save: (container) => {
                $(container).find('lo-i').each(function() {
                    $(this).replaceWith($('<i>' + $(this).html() + '</i>'));
                });
            },
            load: (container) => {
                $(container).find('i,em').each(function() {
                    $(this).replaceWith('<lo-i>' + $(this).html() + '</lo-i>');
                });
            }
        });
        
        this.addPlugin({
            name: 'code',
            type: 'child',
            allow: ['lo-code'],
            style:  `lo-code {
                background: #efefef;
                border-radius: 5px;
                padding: 2px 5px;
            }`,
            button: `<button type="button" class="lo-button-code">
            <svg xmlns="http://www.w3.org/2000/svg"viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="m8.114 12l1.82-1.821q.147-.146.157-.344q.009-.199-.156-.364q-.166-.165-.357-.165t-.357.165l-1.963 1.963q-.131.132-.184.268q-.053.137-.053.298t.053.298t.184.268l1.983 1.982q.146.146.347.156t.366-.156t.165-.354t-.165-.354zm7.773 0l-1.84 1.84q-.147.147-.157.345t.156.363q.166.166.357.166t.357-.166l1.982-1.982q.131-.132.184-.268t.053-.298t-.053-.298t-.184-.267L14.76 9.452q-.073-.073-.165-.11q-.091-.036-.182-.036t-.193.036t-.174.11q-.165.165-.165.354t.165.354zM5.616 20q-.691 0-1.153-.462T4 18.384V5.616q0-.691.463-1.153T5.616 4h12.769q.69 0 1.153.463T20 5.616v12.769q0 .69-.462 1.153T18.384 20z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleSelection('lo-code');
            },
            save: (container) => {
                $(container).find('lo-code').each(function() {
                    $(this).replaceWith($('<code>' + $(this).html() + '</code>'));
                });
            },
            load: (container) => {
                $(container).find('code').each(function() {
                    $(this).replaceWith('<lo-code>' + $(this).html() + '</lo-code>');
                });
            }
        });
        
        this.addPlugin({
            name: 'mark',
            type: 'child',
            allow: ['lo-mark'],
            style:  `lo-mark {
                background: #F2E7D5;
                border-radius: 5px;
                padding: 2px 5px;
            }`,
            button: `<button type="button" class="lo-button-mark">
            <svg xmlns="http://www.w3.org/2000/svg"viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M3 24q-.402 0-.701-.29Q2 23.422 2 23q0-.402.299-.701T3 22h18q.402 0 .701.29q.299.289.299.71q0 .402-.299.701T21 24zm11.004-11.711l-2.6-2.6l-3.885 3.884q-.173.173-.173.423t.173.423l1.748 1.754q.174.173.424.173t.422-.173zM12.117 8.98l2.595 2.594l4.538-4.533q.173-.173.173-.442t-.173-.442l-1.716-1.716q-.172-.173-.442-.173t-.442.173zm-1.061-.36l4.015 4.015l-4.244 4.25q-.485.485-1.134.485t-1.134-.485l-.192-.192l-.683.677q-.217.206-.513.331t-.608.125H5.417q-.273 0-.372-.252t.093-.444l1.839-1.833l-.154-.154q-.484-.485-.49-1.14t.479-1.139zm0 0l4.906-4.906q.484-.484 1.133-.484t1.134.484l1.754 1.748q.484.485.484 1.134q0 .65-.484 1.134l-4.912 4.906z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleSelection('lo-mark');
            },
            save: (container) => {
                $(container).find('lo-mark').each(function() {
                    $(this).replaceWith($('<mark>' + $(this).html() + '</mark>'));
                });
            },
            load: (container) => {
                $(container).find('mark').each(function() {
                    $(this).replaceWith('<lo-mark>' + $(this).html() + '</lo-mark>');
                });
            }
        });
        
        this.addPlugin({
            name: 'link',
            type: 'child',
            allow: ['lo-link'],
            style:  `lo-link {
                color: #990000;
                font-weight: bold;
                padding-bottom: 1px;
                border-bottom: 2px solid #990000;
            }
            lo-link::after {
              content: '';
              position: relative;
              left: 2px;
              height: 20px;
              width: 20px;
              margin-right: 2px;
              background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTUuNjE2IDIwcS0uNjkxIDAtMS4xNTMtLjQ2MlQ0IDE4LjM4NFY1LjYxNnEwLS42OTEuNDYzLTEuMTUzVDUuNjE2IDRoNS42MTV2MUg1LjYxNnEtLjIzMSAwLS40MjQuMTkyVDUgNS42MTZ2MTIuNzY5cTAgLjIzLjE5Mi40MjN0LjQyMy4xOTJoMTIuNzdxLjIzIDAgLjQyMy0uMTkydC4xOTItLjQyM3YtNS42MTZoMXY1LjYxNnEwIC42OS0uNDYyIDEuMTUyVDE4LjM4NCAyMHptNC4xMjMtNS4wM2wtLjcwOC0uNzA5TDE4LjI5MiA1SDE0VjRoNnY2aC0xVjUuNzA4eiIgLz4KPC9zdmc+Cg==');
              background-size: auto;
              background-size: 20px 20px;
              vertical-align: -4px;
              fill: #99000;
              display: inline-block;
            }`,
            button: `<button type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M8.2 20q-1.742 0-2.971-1.229T4 15.8q0-.846.308-1.611q.308-.766.911-1.37l3.023-2.998l.708.708l-3.023 3.004q-.463.463-.705 1.049T4.981 15.8q0 1.34.94 2.27Q6.86 19 8.2 19q.633 0 1.221-.241q.589-.242 1.052-.705l3.018-3.004l.713.714l-3.023 2.998q-.604.604-1.37.92Q9.047 20 8.2 20m1.84-5.346l-.694-.714l4.614-4.613l.713.713zm5.718-.47l-.708-.693l3.023-3.018q.444-.444.683-1.017t.238-1.206q0-1.346-.936-2.298Q17.12 5 15.775 5q-.633 0-1.218.241q-.586.242-1.03.686L10.51 8.95l-.694-.708l3.003-3.004q.604-.604 1.37-.92Q14.954 4 15.8 4q1.742 0 2.968 1.239t1.226 2.986q0 .84-.304 1.596q-.305.756-.91 1.36z" />
            </svg>
            </button>`,
            action: () => {
                let link = this.toggleSelection('lo-link');
                if(link.length != 0) {
                    let url = prompt("Set an URL:");
                    $(link).attr("href", url);
                    $(link).on('click', function(e) {
                        if(e.ctrlKey || e.metaKey) {
                            window.open($(this).attr('href'));
                        }
                    });
                    $(link).on('mouseover', function(e) {
                        $(this).attr("title", "CTRL+Click to open: " + $(this).attr('href'));
                    });
                    $(link).on('mouseout', function(e) {
                        $(this).removeAttr("title");
                    });
                }
            },
            save: (container) => {
                $(container).find('lo-link').each(function() {
                    $(this).replaceWith($('<a href="' + $(this).attr("href") + '">' + $(this).html() + '</a>'));
                });
            },
            load: (container) => {
                $(container).find('a').each(function() {
                    $(this).replaceWith('<lo-link href="' + $(this).attr('href') + '">' + $(this).html() + '</lo-link>');
                });
            },
            events: () => {
                $(this.editor).find('lo-link').each(function() {
                    $(this).on('click', function(e) {
                        if(e.ctrlKey || e.metaKey) {
                            window.open($(this).attr('href'));
                        }
                    });
                    $(this).on('mouseover', function(e) {
                        $(this).attr("title", "CTRL+Click to open: " + $(this).attr('href'));
                    });
                    $(this).on('mouseout', function(e) {
                        $(this).removeAttr("title");
                    });
                });
            }
        });
        
        this.addPlugin({
            name: 'blockquote',
            type: 'textblock',
            style: `.lo-blockquote {
                border-left: 5px solid #990000;
                padding-left: 15px;
                padding-top: 5px;
                padding-bottom: 5px;
                color: #777;
            }`,
            button: `<button type="button" class="lo-button-blockquote"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="m7.012 16.558l1.969-3.424q-.173.097-.404.135t-.461.039q-1.4 0-2.354-.972q-.954-.971-.954-2.336q0-1.4.954-2.354t2.354-.954q1.364 0 2.336.954t.971 2.347q0 .486-.118.906t-.336.793l-3.098 5.366q-.062.112-.175.181t-.25.069q-.288 0-.431-.25t-.003-.5m8.769 0l1.969-3.423q-.173.096-.404.134t-.461.039q-1.4 0-2.354-.972q-.954-.971-.954-2.336q0-1.42.954-2.363t2.354-.945q1.364 0 2.336.954t.971 2.347q0 .486-.118.906t-.335.793l-3.099 5.366q-.062.112-.175.181t-.25.069q-.288 0-.431-.25t-.003-.5m-6.113-5.005q.64-.64.64-1.553t-.64-1.553t-1.552-.64q-.914 0-1.553.64q-.64.64-.64 1.553t.64 1.553t1.553.64t1.552-.64m8.77 0q.639-.64.639-1.553t-.64-1.553t-1.553-.64t-1.552.64q-.64.64-.64 1.553t.64 1.553t1.552.64q.914 0 1.553-.64M8.117 10" />
            </svg>
            </button>`,
            action: () => {
                this.toggleBlock('lo-blockquote');
            },
            save: (container) => {
                $(container).find('.lo-blockquote').each(function() {
                    $(this).replaceWith('<blockquote>' + $(this).html() + '</blockquote>');
                });
            },
            load: (container) => {
                $(container).find('blockquote').each(function() {
                    $(this).replaceWith('<p class="lo-blockquote">' + $(this).html() + '</p>');
                });
            }
        });
        
        this.addPlugin({
            name: 'pre',
            type: 'textblock',
            style: `.lo-pre {
                background: #F3E8E8;
                padding: 10px 15px;
                color: #000;
                font-family: monospace;
                text-align: left;
                border-radius: 10px;
                font-size: 12px;
            }`,
            button: `<button type="button" class="lo-button-pre"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="m4.114 12.006l4.24 4.24q.14.14.15.345q.01.203-.15.363t-.354.16t-.354-.16l-4.388-4.389q-.131-.13-.184-.267q-.053-.136-.053-.298t.053-.298t.184-.267l4.388-4.389q.146-.146.347-.156t.366.156t.166.357t-.165.357zm15.773-.012l-4.24-4.24q-.141-.14-.15-.344t.15-.364t.353-.16t.354.16l4.388 4.389q.131.13.184.267t.053.298t-.053.298t-.184.268l-4.388 4.388q-.146.146-.344.153q-.198.006-.364-.159t-.165-.357q0-.191.165-.357z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleBlock('lo-pre');
            },
            save: (container) => {
                $(container).find('.lo-pre').each(function() {
                    $(this).replaceWith('<pre>' + $(this).html() + '</pre>');
                });
            },
            load: (container) => {
                $(container).find('pre').each(function() {
                    $(this).replaceWith('<p class="lo-pre">' + $(this).html() + '</p>');
                });
            }
        });
        
        this.addPlugin({
            name: 'left',
            type: 'textblock',
            style: `.lo-left {
                text-align: left;
            }`,
            button: `<button type="button" class="lo-button-left"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M4.5 20q-.213 0-.356-.144T4 19.499t.144-.356T4.5 19h15q.213 0 .356.144t.144.357t-.144.356T19.5 20zm0-3.75q-.213 0-.356-.144T4 15.749t.144-.356t.356-.143h9q.213 0 .356.144t.144.357t-.144.356t-.356.143zm0-3.75q-.213 0-.356-.144T4 11.999t.144-.356t.356-.143h15q.213 0 .356.144t.144.357t-.144.356t-.356.143zm0-3.75q-.213 0-.356-.144T4 8.249t.144-.356t.356-.143h9q.213 0 .356.144t.144.357t-.144.356t-.356.143zM4.5 5q-.213 0-.356-.144T4 4.499t.144-.356T4.5 4h15q.213 0 .356.144t.144.357t-.144.356T19.5 5z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleBlock('lo-left');
            },
            save: (container) => {
                $(container).find('.lo-left').each(function() {
                    $(this).replaceWith('<p class="lo-left">' + $(this).html() + '</p>');
                });
            },
            load: (container) => {
                $(container).find('.lo-left').each(function() {
                    $(this).replaceWith('<p class="lo-left">' + $(this).html() + '</p>');
                });
            }
        });
        
        this.addPlugin({
            name: 'center',
            type: 'textblock',
            style: `.lo-center {
                text-align: center;
            }`,
            button: `<button type="button" class="lo-button-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M4.5 20q-.213 0-.356-.144T4 19.499t.144-.356T4.5 19h15q.213 0 .356.144t.144.357t-.144.356T19.5 20zm4-3.75q-.213 0-.356-.144T8 15.749t.144-.356t.356-.143h7q.213 0 .356.144t.144.357t-.144.356t-.356.143zm-4-3.75q-.213 0-.356-.144T4 11.999t.144-.356t.356-.143h15q.213 0 .356.144t.144.357t-.144.356t-.356.143zm4-3.75q-.213 0-.356-.144T8 8.249t.144-.356t.356-.143h7q.213 0 .356.144t.144.357t-.144.356t-.356.143zM4.5 5q-.213 0-.356-.144T4 4.499t.144-.356T4.5 4h15q.213 0 .356.144t.144.357t-.144.356T19.5 5z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleBlock('lo-center');
            },
            save: (container) => {
                $(container).find('.lo-center').each(function() {
                    $(this).replaceWith('<p class="lo-center">' + $(this).html() + '</p>');
                });
            },
            load: (container) => {
                $(container).find('.lo-center').each(function() {
                    $(this).replaceWith('<p class="lo-center">' + $(this).html() + '</p>');
                });
            }
        });
        
        this.addPlugin({
            name: 'right',
            type: 'textblock',
            style: `.lo-right {
                text-align: right;
            }`,
            button: `<button type="button" class="lo-button-right"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M4.5 5q-.213 0-.356-.144T4 4.499t.144-.356T4.5 4h15q.213 0 .356.144t.144.357t-.144.356T19.5 5zm6 3.75q-.213 0-.356-.144T10 8.249t.144-.356t.356-.143h9q.213 0 .356.144t.144.357t-.144.356t-.356.143zm-6 3.75q-.213 0-.356-.144T4 11.999t.144-.356t.356-.143h15q.213 0 .356.144t.144.357t-.144.356t-.356.143zm6 3.75q-.213 0-.356-.144T10 15.749t.144-.356t.356-.143h9q.213 0 .356.144t.144.357t-.144.356t-.356.143zM4.5 20q-.213 0-.356-.144T4 19.499t.144-.356T4.5 19h15q.213 0 .356.144t.144.357t-.144.356T19.5 20z" />
            </svg>
            </button>`,
            action: () => {
                this.toggleBlock('lo-right');
            },
            save: (container) => {
                $(container).find('.lo-right').each(function() {
                    $(this).replaceWith('<p class="lo-right">' + $(this).html() + '</p>');
                });
            },
            load: (container) => {
                $(container).find('.lo-right').each(function() {
                    $(this).replaceWith('<p class="lo-right">' + $(this).html() + '</p>');
                });
            }
        });
        
        this.addPlugin({
            name: 'img',
            type: 'block',
            allow: ['img'],
            style: `.lo-img {
                border-radius: 10px;
                padding: 30px;
                -webkit-user-select: none;
                user-select: none;
                background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPgoJPHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIgLz4KCTxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTUuNjE2IDIwcS0uNjkxIDAtMS4xNTMtLjQ2MlQ0IDE4LjM4NFY1LjYxNnEwLS42OTEuNDYzLTEuMTUzVDUuNjE2IDRoMTIuNzY5cS42OSAwIDEuMTUzLjQ2M1QyMCA1LjYxNnYxMi43NjlxMCAuNjktLjQ2MiAxLjE1M1QxOC4zODQgMjB6bTAtMWgxMi43NjlxLjIzIDAgLjQyMy0uMTkydC4xOTItLjQyNFY1LjYxNnEwLS4yMzEtLjE5Mi0uNDI0VDE4LjM4NCA1SDUuNjE2cS0uMjMxIDAtLjQyNC4xOTJUNSA1LjYxNnYxMi43NjlxMCAuMjMuMTkyLjQyM3QuNDIzLjE5Mk01IDE5VjV6bTMuMzA4LTIuNWg3LjUzOHEuMjQzIDAgLjM1NC0uMjE3dC0uMDMtLjQzbC0yLjAyLTIuNzEycS0uMTMtLjE2Mi0uMzIzLS4xNjJxLS4xOTIgMC0uMzIzLjE2MmwtMi4yOTIgMi44OThsLTEuNDI3LTEuNzI1cS0uMTMxLS4xNDMtLjMxNC0uMTQzcS0uMTgyIDAtLjMxMy4xNjJsLTEuMTU0IDEuNTJxLS4xNjIuMjEzLS4wNS40M3QuMzU0LjIxNyIgLz4KPC9zdmc+Cg==');
                background-color: #eee;
                background-size: 25px 25px;
                background-position: 5px 5px;
                background-repeat: no-repeat;
            }
            p img {
                display: inline-block;
                max-width: 200px;
                vertical-align: top;
                margin: 20px;
            }
            p img:first-child {
                display: block;
                max-width: 500px;
                width: auto;
                margin: 0 auto 10px;
                margin-bottom: 25px;
            }
            @media all and (max-width: 850px) {
                p img {
                    max-width: 100%;
                    width: 100%;
                    margin: 0;
                    margin-bottom: 10px;
                }
                p img:first-child {
                    max-width: 100%;
                    width: 100%;
                    margin: 0;
                    margin-bottom: 10px;
                }
            }`,
            button: `<button type="button" class="lo-button-images"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M11.212 16.039L9.946 14.51q-.186-.223-.475-.213q-.288.01-.475.233l-.992 1.323q-.162.211-.05.429q.112.217.354.217h7.538q.243 0 .354-.217t-.03-.43l-2.187-2.915q-.064-.011-.13-.029q-.066-.017-.13-.04zM5.616 20q-.691 0-1.153-.462T4 18.384V5.616q0-.691.463-1.153T5.616 4H9.5q.214 0 .357.143T10 4.5t-.143.357T9.5 5H5.616q-.231 0-.424.192T5 5.616v12.769q0 .23.192.423t.423.192h12.77q.23 0 .423-.192t.192-.423V14.56q0-.214.143-.357t.357-.143t.357.143t.143.357v3.825q0 .69-.462 1.153T18.384 20zm10.473-10q-1.466 0-2.477-1.014Q12.6 7.97 12.6 6.5t1.015-2.485T16.1 3t2.486 1.015T19.6 6.5q0 .598-.18 1.137T18.9 8.68l2.735 2.735q.14.14.15.344t-.15.363t-.354.16t-.354-.16l-2.785-2.784q-.505.369-.98.515T16.089 10m.011-1q1.05 0 1.775-.725T18.6 6.5t-.725-1.775T16.1 4t-1.775.725T13.6 6.5t.725 1.775T16.1 9" />
            </svg>
            </button>`,
            action: () => {

                // Get current block
                var crt = this.getCurrentParagraph();
                
                // And append a new img block
                let el = $('<p class="lo-img" contenteditable="false"></p>').insertAfter(crt);
                
                // Create file browser input
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;
                input.style.display = 'none';
                document.body.appendChild(input);
                input.click();
                
                // When images are selected, create placeholder for each image (to be able to upload in the selected order)
                input.addEventListener('change', () => {
                    if(!input.files) return;
                    Array.from(input.files).forEach(file => {
                        if(!file.type.startsWith('image/')) return;
                        var the_img = $('<img src="data:image/png;base64,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"/>');
                        $(el).append(the_img);
                        imageUpload(file, the_img);
                    });
                    input.remove();
                }, { once: true });
                
                // On click on the images container, make it movable
                $(el).on("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.makeMovable(el[0]);
                });
                
                // Send image to imageUploadChunks, and add image back to post
                const imageUpload = (file, the_img) => {
                    return imageUploadChunks(file).then((response) => {
                        $(the_img).attr("src", response.url);
                        $(the_img).click((e) => { 
                            this.crtImg = e.currentTarget;
                            return true; 
                        });
                        return response;
                    });
                };
                
                // Upload image by chunks
                // Inspired from: https://dev.to/uploadcare_org/how-to-handle-large-file-uploads-bna
                const imageUploadChunks = (file) => {
                    var chunkSize = 1024 * 1024;
                    var totalChunks = Math.ceil(file.size / chunkSize);
                    var chunkIndex = 0;
                    return new Promise((resolve, reject) => {
                        const uploadChunk = () =>  {
                            var start = chunkIndex * chunkSize;
                            var end = Math.min(start + chunkSize, file.size);
                            var chunk = file.slice(start, end);
                            var formData = new FormData();
                            formData.append("file", chunk);
                            formData.append("fileName", file.name);
                            formData.append("chunkIndex", chunkIndex);
                            formData.append("totalChunks", totalChunks);
                            var xhr = new XMLHttpRequest();
                            xhr.open("POST", this.settings.upload, true);
                            xhr.onload = function() {
                                if(xhr.status == 200) {
                                    chunkIndex++;
                                    if (chunkIndex < totalChunks) {
                                        uploadChunk();
                                    } else {
                                        if(chunkIndex === totalChunks) {
                                            resolve({
                                                url: xhr.responseText,
                                            });
                                        }
                                    }
                                } else {
                                    reject("Upload error.");
                                }
                            };
                            xhr.send(formData);
                        };
                        uploadChunk();
                    });
                };

            },
            save: (container) => {
                $(container).find('.lo-img').each(function() {
                    $(this).replaceWith('<p class="lo-img">' + $(this).html() + '</p>');
                });
            },
            load: (container) => {
                $(container).find('> img').each(function() {
                    $(this).replaceWith('<p class="lo-img" contenteditable="false"><img src="' + $(this).attr('src') + '"></p>');
                });
                $(container).find('.lo-img').each(function() {
                    var el = $('<p class="lo-img" contenteditable="false">' + $(this).html() + '</p>');
                    $(this).replaceWith(el);
                });
                $(container).find('figure').each(function() {
                    var $img = $(this).find('img');
                    var $figcaption = $(this).find('figcaption');
                    if ($img.length === 0) return;
                    var $pImg = $('<p></p>', {
                        'class': 'lo-img',
                        'contenteditable': 'false'
                    }).append('<img src="' + $img.attr('src') + '"/>');
                    var $pText = $('<p></p>', {
                        'class': 'lo-center'
                    });
                    var captionText = $figcaption.text().trim();
                    var $loI = $('<lo-i></lo-i>').text(captionText);
                    $pText.append($loI);
                    $(this).replaceWith($pImg);
                    $pImg.after($pText);
                });
                $(container).find('p').each(function() {
                    if($(this).find('img').length != 0 && !$(this).hasClass('lo-img')) {
                        $(this).addClass('lo-img');
                        $(this).attr("contenteditable", "false");
                    }
                });
            },
            events: () => {
                $(this.editor).find(".lo-img").on("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.makeMovable(e.currentTarget);
                });
                $(this.editor).find(".lo-img img").on("click", (e) => { 
                    this.crtImg = e.currentTarget;
                    return true; 
                }); 
            }
        });
        
        this.addPlugin({
            name: 'separator',
            type: 'block',
            style: `.lo-separator {
                width: 100%;
                height: 5px;
                background: #ccc;
                margin-bottom: 15px;
                margin-top: 15px;
                -webkit-user-select: none;
                user-select: none;
            }`,
            button: `<button type="button" class="lo-button-separator"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M6.616 21q-.667 0-1.141-.475T5 19.386V17q0-.213.144-.356t.357-.144t.356.144T6 17v2.385q0 .269.173.442t.443.173h10.769q.269 0 .442-.173t.173-.443V17q0-.213.144-.356t.357-.144t.356.144T19 17v2.385q0 .666-.475 1.14t-1.14.475zM5 4.616q0-.667.475-1.141T6.615 3h7.214q.331 0 .632.13t.518.349L18.52 7.02q.217.218.348.518t.131.632V11q0 .213-.144.356t-.357.144t-.356-.144T18 11V8h-3.2q-.34 0-.57-.23T14 7.2V4H6.616q-.27 0-.443.173T6 4.616V11q0 .213-.144.356t-.357.144t-.356-.144T5 11zM9.692 14.5q-.212 0-.356-.144t-.144-.357t.144-.356t.356-.143h4.616q.212 0 .356.144t.144.357t-.144.356t-.356.143zm7.616 0q-.213 0-.356-.144t-.144-.357t.144-.356t.356-.143h4.615q.213 0 .356.144t.144.357t-.144.356t-.356.143zm-15.231 0q-.212 0-.356-.144t-.144-.357t.144-.356t.356-.143h4.615q.213 0 .357.144t.143.357t-.143.356t-.357.143zm9.923 2" />
            </svg>
            </button>`,
            action: () => {
                var crt = this.getCurrentParagraph();
                let el = $('<p class="lo-separator" contenteditable="false">&nbsp;</p>').insertAfter(crt);
                $(el).on("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.makeMovable(el[0]);
                });
            },
            save: (container) => {
                $(container).find('.lo-separator').each(function() {
                    $(this).replaceWith('<hr/>');
                });
            },
            load: (container) => {
                $(container).find('hr').each(function() {
                    $(this).replaceWith('<p class="lo-separator" contenteditable="false">&nbsp;</p>');
                });
            },
            events: () => {
                $(this.editor).find(".lo-separator").on("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.makeMovable(e.currentTarget);
                });
            }
        });
        
        this.addPlugin({
            name: 'lo-up',
            type: 'none',
            button: `<button type="button" class="lo-button-up" style="display: none;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M11.5 6.921L6.062 12.36q-.146.146-.345.153q-.198.006-.363-.16q-.16-.164-.163-.353q-.002-.188.163-.354l6.08-6.08q.132-.131.268-.184q.137-.053.298-.053t.298.053t.268.184l6.08 6.08q.14.14.15.342q.01.2-.15.366q-.165.165-.356.165q-.192 0-.357-.165L12.5 6.92V18.5q0 .214-.143.357T12 19t-.357-.143t-.143-.357z" />
            </svg>
            </button>`,
            action: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.moveUp();
            }
        });
        
        this.addPlugin({
            name: 'lo-down',
            type: 'none',
            button: `<button type="button" class="lo-button-down" style="display: none;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M11.5 17.079V5.5q0-.213.143-.357T12 5t.357.143t.143.357v11.579l5.439-5.439q.146-.146.344-.153q.198-.006.363.16q.16.164.163.353q.002.188-.163.354l-6.08 6.08q-.132.131-.268.184t-.298.053t-.298-.053q-.136-.052-.267-.183l-6.081-6.081q-.14-.14-.15-.341q-.01-.202.15-.367q.165-.165.357-.165t.356.165z" />
            </svg></button>`,
            action: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.moveDown();
            }
        });
        
        this.addPlugin({
            name: 'lo-del',
            type: 'none',
            button: `<button type="button" class="lo-button-delete" style="display: none;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" d="M7.616 20q-.672 0-1.144-.472T6 18.385V6h-.5q-.213 0-.357-.143T5 5.5t.143-.357T5.5 5H9q0-.31.23-.54t.54-.23h4.46q.31 0 .54.23T15 5h3.5q.214 0 .357.143T19 5.5t-.143.357T18.5 6H18v12.385q0 .67-.472 1.143q-.472.472-1.143.472zM17 6H7v12.385q0 .269.173.442t.443.173h8.769q.269 0 .442-.173t.173-.442zM7 6v13zm5 7.208l2.246 2.246q.14.14.344.15t.364-.15t.16-.354t-.16-.354L12.708 12.5l2.246-2.246q.14-.14.15-.344t-.15-.364t-.354-.16t-.354.16L12 11.792L9.754 9.546q-.14-.14-.344-.15t-.364.15t-.16.354t.16.354l2.246 2.246l-2.246 2.246q-.14.14-.15.344t.15.364t.354.16t.354-.16z" />
            </svg></button>`,
            action: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.del();
            }
        });
        
        this.addPlugin({
            name: 'lo-clean',
            type: 'none',
            button: `<button type="button" class="lo-button-clean"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            	<path d="M0 0h24v24H0z" fill="none" />
            	<path fill="currentColor" d="M4 22v-5.866q0-1.835 1.294-3.129t3.129-1.294h1.289V3.634q0-.674.462-1.154q.463-.48 1.134-.48h1.384q.672 0 1.134.48q.463.48.463 1.154v8.078h1.269q1.843 0 3.143 1.293Q20 14.3 20 16.135V22zm1-1h2.75v-3.52q0-.212.144-.355t.357-.144t.356.143t.143.357V21h2.75v-3.52q0-.212.144-.355t.357-.144t.356.143t.143.357V21h2.75v-3.52q0-.212.144-.355t.357-.144t.356.143t.143.357V21H19v-4.866q0-1.442-1.004-2.432t-2.438-.99H8.423q-1.426 0-2.424.998Q5 14.708 5 16.134z" />
            </svg>
            </button>`,
            action: (e, self) => {
                var disallowed = [];
                for(var i=0;i<this.plugins.length;i++) {
                    if(this.plugins[i].type == 'block') {
                        disallowed.push('lo-' + this.plugins[i].name);
                    }
                }
                $(this.editor).find('> p').each(function() {
                    if(!disallowed.includes($(this).prop('class').toLowerCase()) && $(this).text().trim() == '') {
                        $(this.remove());
                    }
                });
            }
        });
        
        
    }
    

}

        
// Extend jQuery with a function
$.fn.hasParent = function (e) {
    return !!$(this).parents(e).length;
};
