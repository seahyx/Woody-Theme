# Examples

Sample files for checking how Woody colours real code. Each one models the same small, fictional forest and lumber-yard inventory, and uses as much of its language as reads naturally: declarations and control flow, locals and members, every kind of type, strings with escapes and interpolation, regular expressions, numbers in every notation, and the language's own doc-comment format. Every file opens with a comment listing what it covers.

These files are not part of the extension. `.vscodeignore` keeps them out of the `.vsix`, and `.gitattributes` keeps them out of GitHub's language statistics.

## Viewing them

Press <kbd>F5</kbd> in this repository. The Extension Development Host opens on this folder with the theme loaded, and the theme reloads whenever `pixi run watch` rebuilds it. To see why a token has its colour, run **Developer: Inspect Editor Tokens and Scopes** with the cursor on it.

Turn on semantic highlighting (`editor.semanticHighlighting.enabled`) and install the language's extension where one exists. Language servers can tell locals from members, classes from structs and interfaces, and macros from functions, which TextMate grammars often cannot.

Most formats have built-in highlighting. These need an extension:

| File             | Extension                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kotlin.kt`      | Any Kotlin extension, such as [Kotlin](https://marketplace.visualstudio.com/items?itemName=fwcd.kotlin)                                                   |
| `pyproject.toml` | Any TOML extension, such as [Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)                              |
| `inventory.csv`  | [Rainbow CSV](https://marketplace.visualstudio.com/items?itemName=mechatroner.rainbow-csv), which colours each column with the theme's own syntax colours |

## What to look at

The `token` roles in `src/palette.mjs` explain each colour rule.

- **Keywords and control flow.** Declaration words (`class`, `const`, `int`, `true`, `this`) are the dimmest code colour. Flow words (`if`, `return`, `throw`, `await`, `import`) are split off and brighter.
- **Bold.** Bold follows Solarized Dark: whatever the grammar scopes as storage is bold. That covers declaration words (`class`, `function`, `def`, `let`), modifiers (`public`, `static`) and built-in types (`int`, `void`). Markdown headings and bold text are bold, but setext headings and inline code are not.
- **Names.** Locals and parameters are the same neutral white as the workbench text. Fields and properties stay plain text, a warmer cream. Namespaces and labels are a step dimmer. Functions are the brightest colour after plain text.
- **Types.** Classes are aqua, structs are a lighter mint, and interfaces, enums and type parameters are pale seafoam. Built-in primitives such as `int` stay keywords.
- **Literals.** Strings are green, and escapes and placeholders inside them are a brighter lime. Numbers and enum members are yellow.
- **Regular expressions.** Character classes, anchors and quantifiers, and groups each get their own accent inside the string colour.
- **Out-of-band code.** Preprocessor directives are mauve and macros are magenta. Comments are grey, and doc-comment tags recede further.
- **Data formats.** Keys and attribute names are orange in JSON, YAML, TOML, INI, `.env`, CSS and HTML.

## Files

### Code

| File             | Language                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `python.py`      | Python: dataclasses, enums, protocols, decorators, async, `match`, f-strings, regex           |
| `javascript.js`  | JavaScript: modules, private fields, generators, async, template literals, regex              |
| `typescript.ts`  | TypeScript: interfaces, enums, generics, mapped and conditional types, decorators, namespaces |
| `react.tsx`      | React with TypeScript: components, hooks, JSX                                                 |
| `ruby.rb`        | Ruby: modules, symbols, blocks, heredocs, YARD                                                |
| `lua.lua`        | Lua: tables, metatables, closures, LuaLS annotations                                          |
| `php.php`        | PHP: namespaces, enums, readonly properties, `match`, heredoc, PHPDoc                         |
| `c.c`            | C: preprocessor, macros, structs, enums, unions, pointers, `printf` placeholders              |
| `cpp.cpp`        | C++: namespaces, templates and concepts, operator overloading, user-defined literals          |
| `csharp.cs`      | C#: records, structs, interfaces, events, attributes, LINQ, pattern matching, XML docs        |
| `java.java`      | Java: records, sealed interfaces, enums, switch expressions, streams, Javadoc                 |
| `go.go`          | Go: structs and tags, interfaces, generics, goroutines and channels                           |
| `rust.rs`        | Rust: traits, lifetimes, `macro_rules!`, attributes, `match`, error handling                  |
| `kotlin.kt`      | Kotlin: data and sealed classes, extension functions, coroutines, KDoc                        |
| `swift.swift`    | Swift: protocols, enums with associated values, property wrappers, async                      |
| `shell.sh`       | Bash: parameter expansion, arrays, `case`, here-docs, traps                                   |
| `powershell.ps1` | PowerShell: advanced functions, classes, pipelines, splatting, comment-based help             |
| `sql.sql`        | SQL: DDL, CTEs, window functions, transactions                                                |
| `build.gradle`   | Gradle (Groovy DSL)                                                                           |

### Markup and styles

| File          | Format                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| `html.html`   | HTML with inline CSS, JavaScript and SVG                                        |
| `css.css`     | CSS: every selector kind, custom properties, at-rules, nesting                  |
| `scss.scss`   | SCSS: modules, maps, mixins, functions, control directives, placeholders        |
| `markdown.md` | Markdown: every block and inline element, plus fenced code in several languages |
| `latex.tex`   | LaTeX: document structure, math, tables, bibliography                           |
| `config.xml`  | XML: namespaces, entities, CDATA, processing instructions                       |

### Data and configuration

| File                 | Format                                                      |
| -------------------- | ----------------------------------------------------------- |
| `data.json`          | JSON                                                        |
| `settings.jsonc`     | JSON with comments                                          |
| `inventory.csv`      | CSV                                                         |
| `config.yaml`        | YAML: anchors and aliases, block scalars, every scalar type |
| `docker-compose.yml` | Docker Compose                                              |
| `pyproject.toml`     | TOML                                                        |
| `settings.ini`       | INI                                                         |
| `.env.example`       | dotenv                                                      |
| `Dockerfile`         | Dockerfile: multi-stage build, heredoc                      |
| `Makefile`           | Make: pattern rules, automatic variables, functions         |

### Tooling output

| File              | Format                                                        |
| ----------------- | ------------------------------------------------------------- |
| `changes.diff`    | Unified diff                                                  |
| `git-rebase-todo` | Interactive rebase list (VS Code detects it by its file name) |
| `app.log`         | Application log with levels, timestamps and a stack trace     |
