import React, { useState } from 'react';
import { Download, Palette, Maximize2, X } from 'lucide-react';

function RStudioMockup({ colors, isDark, scale = 1 }: any) {
  const chrome = isDark ? '#3b4148' : '#e8e8e8';
  const chromeLight = isDark ? '#4a5159' : '#f0f0f0';
  const chromeBorder = isDark ? '#2a2f35' : '#cccccc';
  const panelText = isDark ? '#c8ccd0' : '#333333';
  // Side panels derive from the actual editor theme colors so they update live
  const panelBg = colors.background;
  const panelFg = colors.foreground;
  const panelMuted = colors.comment;
  const accent = colors.function;
  
  // Base dimensions based on scale=3
  const baseWidth = 840;
  const baseHeight = 588;

  return (
    <div
      className="rounded-md overflow-hidden shadow-md"
      style={{ 
        width: baseWidth * scale, 
        height: baseHeight * scale,
        position: 'relative'
      }}
    >
      <div 
        style={{ 
          width: baseWidth, 
          height: baseHeight, 
          transform: `scale(${scale})`, 
          transformOrigin: 'top left',
          backgroundColor: chromeBorder,
          border: `1px solid ${chromeBorder}`,
          boxSizing: 'border-box'
        }}
        className="absolute top-0 left-0 flex flex-col"
      >
        {/* Title bar */}
        <div className="flex items-center px-6" style={{ height: 48, backgroundColor: chrome, flexShrink: 0 }}>
          <div className="flex" style={{ gap: 6 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
            <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#febc2e' }} />
            <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#28c840' }} />
          </div>
          <span style={{ color: panelText, fontSize: 18, marginLeft: 24 }}>RStudio</span>
        </div>
        {/* Menu bar */}
        <div className="flex items-center px-6" style={{ height: 30, backgroundColor: chromeLight, gap: 18, flexShrink: 0 }}>
          {['File', 'Edit', 'Code', 'View', 'Plots', 'Session', 'Build', 'Tools', 'Help'].map(m => (
            <span key={m} style={{ color: panelText, fontSize: 15 }}>{m}</span>
          ))}
        </div>
        {/* Body: 2x2 panel grid */}
        <div className="flex" style={{ height: 510, flexShrink: 0 }}>
          {/* Left column */}
          <div className="flex flex-col" style={{ width: '50%', borderRight: `1px solid ${chromeBorder}` }}>
            {/* Source editor */}
            <div style={{ height: '50%', borderBottom: `1px solid ${chromeBorder}` }}>
              <div className="flex items-center px-3" style={{ height: 36, backgroundColor: chrome, gap: 12 }}>
                <span style={{ color: panelText, fontSize: 15 }}>script.R</span>
              </div>
              <div className="flex" style={{ height: `calc(100% - 36px)`, backgroundColor: colors.background }}>
                <div style={{ width: 36, backgroundColor: colors.gutter, color: colors.gutterForeground, fontSize: 13.5, paddingLeft: 4.5, lineHeight: 1.5, textAlign: 'right', paddingRight: 4.5 }}>
                  1<br/>2<br/>3<br/>4<br/>5<br/>6
                </div>
                <div style={{ fontSize: 13.5, padding: 4.5, lineHeight: 1.5, fontFamily: 'monospace' }}>
                  <div><span style={{ color: colors.comment, fontStyle: 'italic' }}># analysis</span></div>
                  <div><span style={{ color: colors.function }}>library</span><span style={{ color: colors.operator }}>(</span><span style={{ color: colors.function }}>ggplot2</span><span style={{ color: colors.operator }}>)</span></div>
                  <div><span style={{ color: colors.function }}>x</span> <span style={{ color: colors.operator }}>&lt;-</span> <span style={{ color: colors.number }}>42</span></div>
                  <div><span style={{ color: colors.function }}>f</span> <span style={{ color: colors.operator }}>&lt;-</span> <span style={{ color: colors.keyword }}>function</span><span style={{ color: colors.operator }}>(</span><span style={{ color: colors.function }}>y</span><span style={{ color: colors.operator }}>)</span> <span style={{ color: colors.operator }}>{'{'}</span></div>
                  <div>&nbsp;&nbsp;<span style={{ color: colors.keyword }}>return</span><span style={{ color: colors.operator }}>(</span><span style={{ color: colors.function }}>y</span><span style={{ color: colors.operator }}>)</span></div>
                  <div><span style={{ color: colors.operator }}>{'}'}</span></div>
                </div>
              </div>
            </div>
            {/* Console / Terminal */}
            <div style={{ height: '50%' }}>
              <div className="flex items-center px-3" style={{ height: 36, backgroundColor: chrome, gap: 12 }}>
                <span style={{ color: panelMuted, fontSize: 15 }}>Console</span>
                <span style={{ color: panelText, fontSize: 15, fontWeight: 'bold', borderBottom: `2px solid ${colors.caret}` }}>Terminal</span>
                <span style={{ color: panelMuted, fontSize: 15 }}>Jobs</span>
              </div>
              <div style={{ height: `calc(100% - 36px)`, backgroundColor: colors.terminalBackground, fontSize: 13.5, padding: 4.5, lineHeight: 1.5, fontFamily: 'monospace' }}>
                <div><span style={{ color: colors.function }}>user@pc</span><span style={{ color: colors.terminalForeground }}>:</span><span style={{ color: colors.string }}>~/proj</span><span style={{ color: colors.terminalForeground }}>$ </span><span style={{ color: colors.terminalForeground }}>ls</span></div>
                <div style={{ color: colors.terminalForeground }}>data&nbsp;&nbsp;script.R</div>
                <div><span style={{ color: colors.function }}>user@pc</span><span style={{ color: colors.terminalForeground }}>:</span><span style={{ color: colors.string }}>~/proj</span><span style={{ color: colors.terminalForeground }}>$ </span><span style={{ color: colors.keyword }}>git</span><span style={{ color: colors.terminalForeground }}> status</span></div>
                <div><span style={{ color: colors.function }}>user@pc</span><span style={{ color: colors.terminalForeground }}>:</span><span style={{ color: colors.string }}>~/proj</span><span style={{ color: colors.terminalForeground }}>$ </span><span style={{ color: colors.caret }}>█</span></div>
              </div>
            </div>
          </div>
          {/* Right column */}
          <div className="flex flex-col" style={{ width: '50%' }}>
            {/* Environment */}
            <div style={{ height: '50%', borderBottom: `1px solid ${chromeBorder}` }}>
              <div className="flex items-center px-3" style={{ height: 36, backgroundColor: chrome, gap: 12 }}>
                <span style={{ color: panelText, fontSize: 15 }}>Environment</span>
                <span style={{ color: panelMuted, fontSize: 15 }}>History</span>
              </div>
              <div style={{ height: `calc(100% - 36px)`, backgroundColor: panelBg, fontSize: 13.5, padding: 6, color: panelFg }}>
                <div style={{ color: panelMuted, fontSize: 12 }}>Global Environment</div>
                <div style={{ marginTop: 6 }}><span style={{ color: accent }}>x</span> &nbsp; 42</div>
                <div><span style={{ color: accent }}>f</span> &nbsp; function (y)</div>
              </div>
            </div>
            {/* Files/Plots */}
            <div style={{ height: '50%' }}>
              <div className="flex items-center px-3" style={{ height: 36, backgroundColor: chrome, gap: 12 }}>
                <span style={{ color: panelText, fontSize: 15 }}>Files</span>
                <span style={{ color: panelMuted, fontSize: 15 }}>Plots</span>
                <span style={{ color: panelMuted, fontSize: 15 }}>Packages</span>
              </div>
              <div style={{ height: `calc(100% - 36px)`, backgroundColor: panelBg, fontSize: 13.5, padding: 6, color: panelFg }}>
                <div><span style={{ color: accent }}>📁</span> data</div>
                <div><span style={{ color: accent }}>📁</span> R</div>
                <div>📄 script.R</div>
                <div>📄 README.md</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RStudioMiniPreview({ colors, isDark, onClick }: any) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="relative group cursor-pointer transition-transform hover:scale-105 rounded-md overflow-hidden block"
      title="Click to enlarge"
    >
      <RStudioMockup colors={colors} isDark={isDark} scale={1/3} />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all">
        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

const predefinedThemes = [
  {
    name: "Win95 Classic",
    isDark: false,
    colors: {
      background: '#ffffff',
      foreground: '#000000',
      caret: '#000000',
      selection: '#000080',
      lineHighlight: '#e8e8e8',
      gutter: '#c0c0c0',
      gutterForeground: '#808080',
      comment: '#008000',
      string: '#800000',
      number: '#0000ff',
      keyword: '#0000ff',
      function: '#000000',
      variable: '#000000',
      operator: '#000000',
      class: '#000000',
      constant: '#000000',
      terminalBackground: '#000000',
      terminalForeground: '#c0c0c0',
    }
  },
  {
    name: "Dracula",
    isDark: true,
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      caret: '#f8f8f0',
      selection: '#44475a',
      lineHighlight: '#44475a',
      gutter: '#282a36',
      gutterForeground: '#6272a4',
      comment: '#6272a4',
      string: '#f1fa8c',
      number: '#bd93f9',
      keyword: '#ff79c6',
      function: '#50fa7b',
      variable: '#f8f8f2',
      operator: '#ff79c6',
      class: '#8be9fd',
      constant: '#bd93f9',
      terminalBackground: '#282a36',
      terminalForeground: '#f8f8f2',
    }
  },
  {
    name: "Tomorrow Night 80s",
    isDark: true,
    colors: {
      background: '#2d2d2d',
      foreground: '#cccccc',
      caret: '#aeafad',
      selection: '#515151',
      lineHighlight: '#393939',
      gutter: '#2d2d2d',
      gutterForeground: '#999999',
      comment: '#999999',
      string: '#8abeb7',
      number: '#f99157',
      keyword: '#cc99cc',
      function: '#6699cc',
      variable: '#cccccc',
      operator: '#66cccc',
      class: '#ffcc66',
      constant: '#f99157',
      terminalBackground: '#2d2d2d',
      terminalForeground: '#cccccc',
    }
  },
  {
    name: "Solarized Light",
    isDark: false,
    colors: {
      background: '#fdf6e3',
      foreground: '#657b83',
      caret: '#000000',
      selection: '#eee8d5',
      lineHighlight: '#eee8d5',
      gutter: '#fdf6e3',
      gutterForeground: '#93a1a1',
      comment: '#93a1a1',
      string: '#2aa198',
      number: '#d33682',
      keyword: '#859900',
      function: '#268bd2',
      variable: '#657b83',
      operator: '#93a1a1',
      class: '#b58900',
      constant: '#cb4b16',
      terminalBackground: '#fdf6e3',
      terminalForeground: '#657b83',
    }
  },
  {
    name: "Monokai",
    isDark: true,
    colors: {
      background: '#272822',
      foreground: '#f8f8f2',
      caret: '#f8f8f0',
      selection: '#49483e',
      lineHighlight: '#3e3d32',
      gutter: '#272822',
      gutterForeground: '#90908a',
      comment: '#75715e',
      string: '#e6db74',
      number: '#ae81ff',
      keyword: '#f92672',
      function: '#a6e22e',
      variable: '#f8f8f2',
      operator: '#f92672',
      class: '#66d9ef',
      constant: '#ae81ff',
      terminalBackground: '#272822',
      terminalForeground: '#f8f8f2',
    }
  }
];

export default function RStudioThemeEditor() {
  const [themeName, setThemeName] = useState('My Custom Theme');
  const [isDark, setIsDark] = useState(true);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [colors, setColors] = useState({
    background: '#282c34',
    foreground: '#abb2bf',
    caret: '#ff0520',
    selection: '#4e535c',
    lineHighlight: '#282A2E',
    gutter: '#282c34',
    gutterForeground: '#464d5c',
    comment: '#56606e',
    string: '#98c375',
    number: '#DE935F',
    keyword: '#c681dd',
    function: '#61adec',
    variable: '#abb2bf',
    operator: '#abb2bf',
    class: '#F0C674',
    constant: '#DE935F',
    terminalBackground: '#000000',
    terminalForeground: '#c5c8c6',
  });

  const updateColor = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const generateRsTheme = () => {
    const css = `/* rs-theme-name: ${themeName} */
/* rs-theme-is-dark: ${isDark ? 'TRUE' : 'FALSE'} */

.ace_gutter {
  background: ${colors.gutter};
  color: ${colors.gutterForeground};
}

.ace_print-margin {
  width: 1px;
  background: ${colors.lineHighlight};
}

.ace_editor,
.rstudio-themes-flat.ace_editor_theme .profvis-flamegraph,
.rstudio-themes-flat.ace_editor_theme,
.rstudio-themes-flat .ace_editor_theme {
  background-color: ${colors.background};
  color: ${colors.foreground};
}

.ace_cursor {
  color: ${colors.caret};
}

.ace_marker-layer .ace_selection {
  background: ${colors.selection};
}

.ace_marker-layer .ace_bracket {
  margin: -1px 0 0 -1px;
  border: 1px solid ${colors.operator};
}

.ace_marker-layer .ace_active-line {
  background: ${colors.lineHighlight};
}

.ace_gutter-active-line {
  background-color: ${colors.lineHighlight};
}

.ace_marker-layer .ace_selected-word {
  border: 1px solid ${colors.selection};
}

.ace_invisible {
  color: ${colors.gutterForeground};
}

.ace_keyword,
.ace_meta,
.ace_storage,
.ace_storage.ace_type {
  color: ${colors.keyword};
}

.ace_keyword.ace_operator {
  color: ${colors.operator};
}

.ace_constant.ace_numeric {
  color: ${colors.number};
}

.ace_constant.ace_language,
.ace_constant.ace_character {
  color: ${colors.constant};
}

.ace_invalid {
  color: ${colors.foreground};
  background-color: #df5f5f;
}

.ace_fold {
  background-color: ${colors.keyword};
  border-color: ${colors.foreground};
}

.ace_entity.ace_name.ace_function,
.ace_support.ace_function,
.ace_identifier {
  color: ${colors.function};
}

.ace_variable,
.ace_variable.ace_parameter {
  color: ${colors.variable};
}

.ace_support.ace_class,
.ace_support.ace_type,
.ace_entity.ace_name.ace_type,
.ace_entity.ace_name.ace_class {
  color: ${colors.class};
}

.ace_string {
  color: ${colors.string};
}

.ace_string.ace_quasi,
.ace_string.ace_quasi .ace_string {
  color: ${colors.string};
}

.ace_comment {
  color: ${colors.comment};
  font-style: italic;
}

.ace_indent-guide {
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNgYGBgYHB3d/8PAAOIAdULw8qMAAAAAElFTkSuQmCC) right repeat-y;
}

.ace_bracket {
  margin: 0 !important;
  border: 0 !important;
  background-color: rgba(128, 128, 128, 0.5);
}

.rstudio-themes-flat.rstudio-themes-dark-menus .ace_editor.ace_autocomplete {
  background: ${colors.gutter};
  border: solid 1px ${colors.gutterForeground} !important;
  color: ${colors.foreground};
}

.rstudio-themes-flat.rstudio-themes-dark-menus .ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line,
.rstudio-themes-flat.rstudio-themes-dark-menus .ace_editor.ace_autocomplete .ace_marker-layer .ace_line-hover {
  background: ${colors.selection};
  border: none;
}

.terminal {
  background-color: ${colors.terminalBackground};
  color: ${colors.terminalForeground};
  font-feature-settings: "liga" 0;
  position: relative;
  user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
}

.terminal .xterm-viewport {
  background-color: ${colors.terminalBackground};
  overflow-y: scroll;
}

.xtermInvertColor { 
  color: ${colors.terminalBackground}; 
}

.xtermInvertBgColor { 
  background-color: ${colors.terminalForeground}; 
}`;

    return css;
  };

  const downloadTheme = () => {
    const css = generateRsTheme();
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${themeName.replace(/\s+/g, '-').toLowerCase()}.rstheme`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ColorInput = ({ label, value, onChange }: any) => (
    <div className="flex items-center justify-between p-2 hover:bg-ink/5 rounded">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border-2 border-ink/20"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1 text-sm border border-ink/20 rounded font-mono bg-paper text-ink"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper pt-32 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-surface rounded-3xl border border-ink/5 shadow-sm p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-2xl">
                <Palette className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-ink">RStudio Theme Editor</h1>
                <p className="text-sm text-ink/60 mt-1 uppercase tracking-widest">Design and download custom .rstheme files</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex flex-col items-center gap-2">
                <RStudioMiniPreview colors={colors} isDark={isDark} onClick={() => setShowFullPreview(true)} />
                <span className="text-[10px] uppercase tracking-widest text-ink/40">Click to enlarge</span>
              </div>
              <button
                onClick={downloadTheme}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-2xl hover:bg-accent/90 transition-colors font-medium text-sm tracking-wide shadow-lg shadow-accent/20"
              >
                <Download className="w-4 h-4" />
                Download Theme
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-widest font-black text-ink/40">Presets</label>
              <select
                onChange={(e) => {
                  const theme = predefinedThemes.find(t => t.name === e.target.value);
                  if (theme) {
                    setThemeName(theme.name);
                    setIsDark(theme.isDark);
                    setColors(theme.colors);
                  }
                }}
                className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
              >
                <option value="">Select a preset...</option>
                {predefinedThemes.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-widest font-black text-ink/40">Theme Name</label>
              <input
                type="text"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                className="w-full px-6 py-4 bg-paper border border-ink/10 rounded-2xl focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-widest font-black text-ink/40">Theme Type</label>
              <div className="flex gap-6 h-[58px] items-center px-4 bg-paper border border-ink/10 rounded-2xl">
                <label className="flex items-center cursor-pointer gap-2">
                  <input
                    type="radio"
                    checked={isDark}
                    onChange={() => setIsDark(true)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-ink/80">Dark Theme</span>
                </label>
                <label className="flex items-center cursor-pointer gap-2">
                  <input
                    type="radio"
                    checked={!isDark}
                    onChange={() => setIsDark(false)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-ink/80">Light Theme</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-surface rounded-3xl border border-ink/5 shadow-sm p-8 space-y-8">
            <div>
              <h2 className="text-[10px] uppercase tracking-widest font-black text-ink/40 mb-4 border-b border-ink/5 pb-2">Editor Colors</h2>
              <div className="space-y-1">
                <ColorInput label="Background" value={colors.background} onChange={(v: string) => updateColor('background', v)} />
                <ColorInput label="Foreground (default text)" value={colors.foreground} onChange={(v: string) => updateColor('foreground', v)} />
                <ColorInput label="Caret (blinking cursor)" value={colors.caret} onChange={(v: string) => updateColor('caret', v)} />
                <ColorInput label="Selection (highlighted text)" value={colors.selection} onChange={(v: string) => updateColor('selection', v)} />
                <ColorInput label="Line Highlight (current line)" value={colors.lineHighlight} onChange={(v: string) => updateColor('lineHighlight', v)} />
                <ColorInput label="Gutter Background (line numbers area)" value={colors.gutter} onChange={(v: string) => updateColor('gutter', v)} />
                <ColorInput label="Gutter Text (line numbers)" value={colors.gutterForeground} onChange={(v: string) => updateColor('gutterForeground', v)} />
              </div>
            </div>

            <div>
              <h2 className="text-[10px] uppercase tracking-widest font-black text-ink/40 mb-4 border-b border-ink/5 pb-2">Terminal Colors</h2>
              <div className="space-y-1">
                <ColorInput label="Terminal Background" value={colors.terminalBackground} onChange={(v: string) => updateColor('terminalBackground', v)} />
                <ColorInput label="Terminal Text" value={colors.terminalForeground} onChange={(v: string) => updateColor('terminalForeground', v)} />
              </div>
            </div>

            <div>
              <h2 className="text-[10px] uppercase tracking-widest font-black text-ink/40 mb-4 border-b border-ink/5 pb-2">Syntax Colors</h2>
              <div className="space-y-1">
                <ColorInput label="Comments (# text)" value={colors.comment} onChange={(v: string) => updateColor('comment', v)} />
                <ColorInput label='Strings ("text")' value={colors.string} onChange={(v: string) => updateColor('string', v)} />
                <ColorInput label="Numbers (1, 2, 3)" value={colors.number} onChange={(v: string) => updateColor('number', v)} />
                <ColorInput label="Keywords (function, return)" value={colors.keyword} onChange={(v: string) => updateColor('keyword', v)} />
                <ColorInput label="Identifiers (library, data, x)" value={colors.function} onChange={(v: string) => updateColor('function', v)} />
                <ColorInput label="Operators (<-, +, =)" value={colors.operator} onChange={(v: string) => updateColor('operator', v)} />
                <ColorInput label="Constants (TRUE, FALSE)" value={colors.constant} onChange={(v: string) => updateColor('constant', v)} />
                <ColorInput label="Classes/Types (rare in R)" value={colors.class} onChange={(v: string) => updateColor('class', v)} />
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-3xl border border-ink/5 shadow-sm p-8">
            <h2 className="text-[10px] uppercase tracking-widest font-black text-ink/40 mb-6 border-b border-ink/5 pb-2">Preview</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-ink/80 mb-3">Code Editor</h3>
                <div
                  className="rounded-2xl p-6 font-mono text-sm overflow-auto shadow-inner"
                  style={{ backgroundColor: colors.background, color: colors.foreground }}
                >
                  <pre className="whitespace-pre-wrap">
                    <span style={{ color: colors.comment, fontStyle: 'italic' }}># This is a comment</span>
                    {'\n'}
                    <span style={{ color: colors.function }}>library</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>ggplot2</span>
                    <span style={{ color: colors.operator }}>)</span>
                    {'\n\n'}
                    <span style={{ color: colors.function }}>calculate_mean</span>
                    {' '}
                    <span style={{ color: colors.operator }}>&lt;-</span>
                    {' '}
                    <span style={{ color: colors.keyword }}>function</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>x</span>
                    <span style={{ color: colors.operator }}>)</span>
                    {' '}
                    <span style={{ color: colors.operator }}>{'{'}</span>
                    {'\n  '}
                    <span style={{ color: colors.keyword }}>return</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>mean</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>x</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.function }}>na.rm</span>
                    {' '}
                    <span style={{ color: colors.operator }}>=</span>
                    {' '}
                    <span style={{ color: colors.constant }}>TRUE</span>
                    <span style={{ color: colors.operator }}>))</span>
                    {'\n'}
                    <span style={{ color: colors.operator }}>{'}'}</span>
                    {'\n\n'}
                    <span style={{ color: colors.function }}>data</span>
                    {' '}
                    <span style={{ color: colors.operator }}>&lt;-</span>
                    {' '}
                    <span style={{ color: colors.function }}>c</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.number }}>1</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.number }}>2</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.number }}>3</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.number }}>4</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.number }}>5</span>
                    <span style={{ color: colors.operator }}>)</span>
                    {'\n'}
                    <span style={{ color: colors.function }}>result</span>
                    {' '}
                    <span style={{ color: colors.operator }}>&lt;-</span>
                    {' '}
                    <span style={{ color: colors.function }}>calculate_mean</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>data</span>
                    <span style={{ color: colors.operator }}>)</span>
                    {'\n\n'}
                    <span style={{ color: colors.function }}>ggplot</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>mtcars</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.function }}>aes</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>x</span>
                    {' '}
                    <span style={{ color: colors.operator }}>=</span>
                    {' '}
                    <span style={{ color: colors.function }}>mpg</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.function }}>y</span>
                    {' '}
                    <span style={{ color: colors.operator }}>=</span>
                    {' '}
                    <span style={{ color: colors.function }}>hp</span>
                    <span style={{ color: colors.operator }}>))</span>
                    {' '}
                    <span style={{ color: colors.operator }}>+</span>
                    {'\n  '}
                    <span style={{ color: colors.function }}>geom_point</span>
                    <span style={{ color: colors.operator }}>(</span>
                    <span style={{ color: colors.function }}>color</span>
                    {' '}
                    <span style={{ color: colors.operator }}>=</span>
                    {' '}
                    <span style={{ color: colors.string }}>"blue"</span>
                    <span style={{ color: colors.operator }}>,</span>
                    {' '}
                    <span style={{ color: colors.function }}>size</span>
                    {' '}
                    <span style={{ color: colors.operator }}>=</span>
                    {' '}
                    <span style={{ color: colors.number }}>3</span>
                    <span style={{ color: colors.operator }}>)</span>
                    {' '}
                    <span style={{ color: colors.operator }}>+</span>
                    {'\n  '}
                    <span style={{ color: colors.function }}>theme_minimal</span>
                    <span style={{ color: colors.operator }}>()</span>
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink/80 mb-3">Terminal</h3>
                <div
                  className="rounded-2xl p-6 font-mono text-sm overflow-auto shadow-inner"
                  style={{ 
                    backgroundColor: colors.terminalBackground, 
                    color: colors.terminalForeground,
                    border: `1px solid ${colors.gutterForeground}`
                  }}
                >
                  <pre className="whitespace-pre-wrap">
                    <span style={{ color: colors.function }}>user@computer</span>
                    <span style={{ color: colors.terminalForeground }}>:</span>
                    <span style={{ color: colors.string }}>~/project</span>
                    <span style={{ color: colors.terminalForeground }}>$ </span>
                    <span style={{ color: colors.terminalForeground }}>R --version</span>
                    {'\n'}
                    <span style={{ color: colors.terminalForeground }}>R version 4.3.2 (2023-10-31) -- </span>
                    <span style={{ color: colors.string }}>"Eye Holes"</span>
                    {'\n\n'}
                    <span style={{ color: colors.function }}>user@computer</span>
                    <span style={{ color: colors.terminalForeground }}>:</span>
                    <span style={{ color: colors.string }}>~/project</span>
                    <span style={{ color: colors.terminalForeground }}>$ </span>
                    <span style={{ color: colors.keyword }}>git</span>
                    <span style={{ color: colors.terminalForeground }}> status</span>
                    {'\n'}
                    <span style={{ color: colors.comment }}>On branch main</span>
                    {'\n'}
                    <span style={{ color: colors.string }}>Changes not staged for commit:</span>
                    {'\n  '}
                    <span style={{ color: colors.number }}>modified:   </span>
                    <span style={{ color: colors.terminalForeground }}>analysis.R</span>
                    {'\n\n'}
                    <span style={{ color: colors.function }}>user@computer</span>
                    <span style={{ color: colors.terminalForeground }}>:</span>
                    <span style={{ color: colors.string }}>~/project</span>
                    <span style={{ color: colors.terminalForeground }}>$ </span>
                    <span style={{ color: colors.caret }}>█</span>
                  </pre>
                </div>
              </div>

              <div className="mt-8 p-6 bg-accent/5 rounded-2xl border border-accent/20">
                <h3 className="text-sm font-bold text-accent mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
                  How to Install
                </h3>
                <ol className="text-xs text-ink/80 space-y-2 list-decimal list-inside marker:text-accent font-medium leading-relaxed">
                  <li>Download your custom theme using the button above</li>
                  <li>In RStudio, go to Tools → Global Options → Appearance</li>
                  <li>Click "Add..." and select your .rstheme file</li>
                  <li>Your theme will appear in the editor theme list</li>
                  <li>You may need to restart RStudio for all changes to take effect</li>
                </ol>
                <p className="text-xs text-ink/60 mt-4 italic">
                  Note: The preview here is approximate. Some colors may appear differently in RStudio 
                  depending on syntax context. After installing, you can fine-tune colors and re-import the theme.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/90 backdrop-blur-sm p-4"
          onClick={() => setShowFullPreview(false)}
        >
          <div className="relative shadow-2xl rounded-xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute -top-4 -right-4 z-10 bg-surface border border-ink/10 rounded-full p-2 shadow-lg hover:bg-ink/5 transition-colors"
            >
              <X className="w-5 h-5 text-ink" />
            </button>
            <RStudioMockup colors={colors} isDark={isDark} scale={1} />
          </div>
        </div>
      )}
    </div>
  );
}
