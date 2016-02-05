// Generated by CoffeeScript 1.9.3
(function() {
  var Docco, _, buildMatchers, commander, configure, defaults, document, format, fs, getLanguage, highlightjs, languages, marked, parse, path, run, version, write,
    slice = [].slice;

  document = function(options, callback) {
    var config;
    if (options == null) {
      options = {};
    }
    config = configure(options);
    return fs.mkdirs(config.output, function() {
      var complete, copyAsset, files, nextFile;
      callback || (callback = function(error) {
        if (error) {
          throw error;
        }
      });
      copyAsset = function(file, callback) {
        if (!fs.existsSync(file)) {
          return callback();
        }
        return fs.copy(file, path.join(config.output, path.basename(file)), callback);
      };
      complete = function() {
        return copyAsset(config.css, function(error) {
          if (error) {
            return callback(error);
          }
          if (fs.existsSync(config["public"])) {
            return copyAsset(config["public"], callback);
          }
          return callback();
        });
      };
      files = config.sources.slice();
      nextFile = function() {
        var source;
        source = files.shift();
        return fs.readFile(source, function(error, buffer) {
          var code, sections;
          if (error) {
            return callback(error);
          }
          code = buffer.toString();
          sections = parse(source, code, config);
          format(source, sections, config);
          write(source, sections, config);
          if (files.length) {
            return nextFile();
          } else {
            return complete();
          }
        });
      };
      return nextFile();
    });
  };

  parse = function(source, code, config) {
    var codeText, comment, docsText, hasCode, i, isText, lang, line, lines, match, maybeCode, multiline, save, sections, stripWhitespace, _i, _j, _len, _len1;
    if (config == null) {
      config = {};
    }
    lines = code.split('\n');
    sections = [];
    lang = getLanguage(source, config);
    hasCode = docsText = codeText = '';
    save = function() {
      var multiline, stripWhitespace;
      sections.push({
        docsText: docsText,
        codeText: codeText
      });
      hasCode = docsText = codeText = '';
      multiline = false;
      return stripWhitespace = 0;
    };
    if (lang.literate) {
      isText = maybeCode = true;
      for (i = j = 0, len = lines.length; j < len; i = ++j) {
        line = lines[i];
        lines[i] = maybeCode && (match = /^([ ]{4}|[ ]{0,3}\t)/.exec(line)) ? (isText = false, line.slice(match[0].length)) : (maybeCode = /^\s*$/.test(line)) ? isText ? lang.symbol : '' : (isText = true, lang.symbol + ' ' + line);
      }
    }
    for (_j = 0, _len1 = lines.length; _j < _len1; _j++) {
      line = lines[_j];
      if (multiline) {
        comment = line.slice(stripWhitespace);
      } else if ((match = line.match(lang.commentMatcher)) && !line.match(lang.commentFilter)) {
        comment = match[1];
      } else {
        comment = '';
      }
      if (lang.commentEnter && !multiline && (match = line.match(lang.commentEnter))) {
        line = comment = match[2];
        stripWhitespace = match[1].length;
        multiline = true;
      }
      if (lang.commentExit && multiline && (match = line.match(lang.commentExit))) {
        line = comment = match[1];
        stripWhitespace = 0;
        multiline = false;
      }
      if (comment) {
        if (hasCode) {
          save();
        }
        docsText += comment + '\n';
        if (/^(---+|===+)$/.test(line)) {
          save();
        }
      } else {
        hasCode = true;
        codeText += line + '\n';
      }
    }
    save();
    return sections;
  };

  format = function(source, sections, config) {
    var code, i, j, language, len, markedOptions, results, section;
    language = getLanguage(source, config);
    markedOptions = {
      smartypants: true
    };
    if (config.marked) {
      markedOptions = config.marked;
    }
    marked.setOptions(markedOptions);
    marked.setOptions({
      highlight: function(code, lang) {
        lang || (lang = language.name);
        if (highlightjs.getLanguage(lang)) {
          return highlightjs.highlight(lang, code).value;
        } else {
          console.warn("docco: couldn't highlight code block with unknown language '" + lang + "' in " + source);
          return code;
        }
      }
    });
    results = [];
    for (i = j = 0, len = sections.length; j < len; i = ++j) {
      section = sections[i];
      code = highlightjs.highlight(language.name, section.codeText).value;
      code = code.replace(/\s+$/, '');
      section.codeHtml = "<div class='highlight'><pre>" + code + "</pre></div>";
      results.push(section.docsHtml = marked(section.docsText));
    }
    return results;
  };

  write = function(source, sections, config) {
    var css, destination, first, firstSection, hasTitle, html, relative, title;
    destination = function(file) {
      return path.join(config.output, path.dirname(file), path.basename(file, path.extname(file)) + '.html');
    };
    relative = function(file) {
      var from, to;
      to = path.dirname(path.resolve(file));
      from = path.dirname(path.resolve(destination(source)));
      return path.join(path.relative(from, to), path.basename(file));
    };
    firstSection = _.find(sections, function(section) {
      return section.docsText.length > 0;
    });
    if (firstSection) {
      first = marked.lexer(firstSection.docsText)[0];
    }
    hasTitle = first && first.type === 'heading' && first.depth === 1;
    title = hasTitle ? first.text : path.basename(source);
    css = relative(path.join(config.output, path.basename(config.css)));
    html = config.template({
      sources: config.sources,
      css: css,
      title: title,
      hasTitle: hasTitle,
      sections: sections,
      path: path,
      destination: destination,
      relative: relative
    });
    console.log("docco: " + source + " -> " + (destination(source)));
    return fs.outputFileSync(destination(source), html);
  };

  defaults = {
    layout: 'parallel',
    output: 'docs',
    template: null,
    css: null,
    extension: null,
    languages: {},
    marked: null
  };

  configure = function(options) {
    var config, dir;
    config = _.extend({}, defaults, _.pick.apply(_, [options].concat(slice.call(_.keys(defaults)))));
    config.languages = buildMatchers(config.languages);
    if (options.template) {
      if (!options.css) {
        console.warn("docco: no stylesheet file specified");
      }
      config.layout = null;
    } else {
      dir = config.layout = path.join(__dirname, 'resources', config.layout);
      if (fs.existsSync(path.join(dir, 'public'))) {
        config["public"] = path.join(dir, 'public');
      }
      config.template = path.join(dir, 'docco.jst');
      config.css = options.css || path.join(dir, 'docco.css');
    }
    config.template = _.template(fs.readFileSync(config.template).toString());
    if (options.marked) {
      config.marked = JSON.parse(fs.readFileSync(options.marked));
    }
    config.sources = options.args.filter(function(source) {
      var lang;
      lang = getLanguage(source, config);
      if (!lang) {
        console.warn("docco: skipped unknown type (" + (path.basename(source)) + ")");
      }
      return lang;
    }).sort();
    return config;
  };

  _ = require('underscore');

  fs = require('fs-extra');

  path = require('path');

  marked = require('marked');

  commander = require('commander');

  highlightjs = require('highlight.js');

  languages = JSON.parse(fs.readFileSync(path.join(__dirname, 'resources', 'languages.json')));

  buildMatchers = function(languages) {
    var ext, l;
    for (ext in languages) {
      l = languages[ext];
      l.commentMatcher = RegExp("^\\s*" + l.symbol + "\\s?(.*)$");
      if (l.multiline) {
        l.commentEnter = RegExp("^(\\s*)" + l.multiline + "\\s?(.*)$");
        l.commentExit = RegExp("^(.*)\\s?" + l.multiline + "\\s*$");
      }
      l.commentFilter = /(^#![/]|^\s*#\{)/;
    }
    return languages;
  };

  languages = buildMatchers(languages);

  getLanguage = function(source, config) {
    var codeExt, codeLang, ext, lang, _ref;
    ext = config.extension || path.extname(source) || path.basename(source);
    lang = ((_ref = config.languages) != null ? _ref[ext] : void 0) || languages[ext];
    if (lang && lang.name === 'markdown') {
      codeExt = path.extname(path.basename(source, ext));
      if (codeExt && (codeLang = languages[codeExt])) {
        lang = _.extend({}, codeLang, {
          literate: true
        });
      }
    }
    return lang;
  };

  version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))).version;

  run = function(args) {
    var c;
    if (args == null) {
      args = process.argv;
    }
    c = defaults;
    commander.version(version).usage('[options] files').option('-L, --languages [file]', 'use a custom languages.json', _.compose(JSON.parse, fs.readFileSync)).option('-l, --layout [name]', 'choose a layout (parallel, linear or classic)', c.layout).option('-o, --output [path]', 'output to a given folder', c.output).option('-c, --css [file]', 'use a custom css file', c.css).option('-t, --template [file]', 'use a custom .jst template', c.template).option('-e, --extension [ext]', 'assume a file extension for all inputs', c.extension).option('-m, --marked [file]', 'use custom marked options', c.marked).parse(args).name = "docco";
    if (commander.args.length) {
      return document(commander);
    } else {
      return console.log(commander.helpInformation());
    }
  };

  Docco = module.exports = {
    run: run,
    document: document,
    parse: parse,
    format: format,
    version: version
  };

}).call(this);
