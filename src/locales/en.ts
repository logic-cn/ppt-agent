export const en = {
  "app.name": "PPT Agent",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.saved": "Saved",
  "common.close": "Close",
  "common.retry": "Retry",
  "common.copy": "Copy",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.loaded": "Loaded",
  "common.error": "Error",
  "common.warning": "Warning",
  "common.success": "Success",
  "common.info": "Info",
  "common.exportPpt": "Export PPT",
  "common.exporting": "Exporting…",
  "common.settings": "Settings",
  "common.language": "Language",
  "common.theme": "Theme",
  "common.generating": "Generating…",
  "common.empty": "No content",
  "common.redrawSync": "Redraw Sync",
  "editor.pageOf": "Page {n} of {total}",

  "settings.general": "General",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.themeSystem": "System",
  "settings.modelSection": "Model Settings",
  "settings.currentModel": "Current default model",
  "settings.missingApiKey": "Missing API Key",
  "settings.inUse": "In use",
  "settings.useModel": "Use",
  "settings.addCustomModel": "Add custom model",
  "settings.removeCustomModel": "Remove custom model",
  "settings.removeCustomConfirm":
    "Remove this custom model? Its API key will also be cleared.",
  "settings.customNamePlaceholder": "Name (e.g. Moonshot)",
  "settings.customBaseUrlPlaceholder": "https://api.example.com/v1",
  "settings.customModelPlaceholder": "Model name (e.g. moonshot-v1-32k)",
  "settings.modelName": "Model",
  "settings.pexelsKey": "Pexels API Key (optional, for web image search)",
  "settings.researchSection": "Web Research (topic supplements)",
  "settings.researchHelp":
    "Before generating from a topic, search the web via Tavily and feed the results as source material. Get a free key at tavily.com.",
  "settings.researchEnable": "Enable web research",
  "settings.tavilyKey": "Tavily API Key",
  "settings.pexelsKeyPlaceholder":
    "Free key at pexels.com/api — Openverse works without one",

  "model.title": "Built-in Local Model",
  "model.help":
    "Runs fully offline on your machine — no API key needed. Download once; generation never touches the network afterwards.",
  "model.tier": "Model tier",
  "model.tierStandard": "MiniCPM5-2B · Recommended (~1.46 GB, needs 8 GB RAM)",
  "model.tierLight": "MiniCPM5-1B · Fast (~0.64 GB, for low-end machines)",
  "model.absent": "Not downloaded",
  "model.downloading": "Downloading… {percent}%",
  "model.verifying": "Verifying integrity…",
  "model.downloaded": "Downloaded, not loaded",
  "model.loading": "Loading into memory…",
  "model.loaded": "Ready",
  "model.error": "Error: {message}",
  "model.unsupported": "The local model is available in the desktop app only",
  "model.download": "Download model",
  "model.load": "Load model",
  "model.unload": "Unload (free memory)",
  "model.delete": "Delete model file",
  "model.deleteConfirm":
    "Delete the local model file? You will need to download it again.",
  "model.readyChip": "Local model is ready",
  "model.gateTitle": "Download the local model to get started",
  "model.gateDesc":
    "About {size} once; fully offline afterwards. You can also connect an external LLM instead.",
  "model.gateSwitch": "Use an external LLM instead",
  "model.attributions":
    "Local model: MiniCPM5 (OpenBMB, Apache-2.0); inference engine: llama.cpp (MIT).",

  "settings.aboutSection": "About & Updates",
  "settings.appVersion": "Current version",
  "settings.modelCredits":
    "Built-in on-device model MiniCPM5 (Apache-2.0, © OpenBMB) · inference engine llama.cpp (MIT). After a model download, the full license notice is saved next to the model file.",
  "settings.checkUpdate": "Check for updates",
  "settings.checkingUpdate": "Checking for updates…",
  "settings.upToDate": "You are on the latest version",
  "settings.updateAvailable": "New version {version} available",
  "settings.installUpdate": "Download & install",
  "settings.installingUpdate": "Downloading {percent}%",
  "settings.updateInstalled": "Update installed — restart the app to apply",
  "settings.updateUnsupported":
    "Auto-update is available in the desktop app only",
  "settings.updateFailed": "Update check failed: {message}",

  "home.slideCountSummary": "{slidesCount} pages",
  "home.startCreating": "Start Creating",
  "home.newBlankDeck": "New Blank Deck",
  "home.generateFromTopic": "Generate from a topic",
  "home.importDocument": "Import Document",
  "home.pickStyleHint": "Pick a polished style as your starting point",
  "home.recentProjects": "Recent Projects",
  "home.quickStart": "Quick Start",
  "home.stepFillTopic": "Fill in the topic",
  "home.stepFillTopicDesc":
    'Click "New Blank Deck" → enter a PPT topic in the AI panel on the right',
  "home.stepAdjustOutline": "Adjust the outline",
  "home.stepAdjustOutlineDesc":
    "Drag to reorder on the left, edit titles, and switch page layouts",
  "home.stepExportDesc":
    'After previewing, click "Export PPT" to download the .pptx file',
  "home.apiKeyHint":
    "💡 Tip: go to Settings and enter your API Key first to use AI generation",
  "home.deleteProject": "Delete Project",
  "home.deleteProjectConfirm":
    "Are you sure you want to delete this project? This action cannot be undone.",
  "home.importProject": "Import project JSON",
  "home.importingProject": "Importing…",
  "home.importProjectSuccess": "Project imported",
  "home.importProjectSuccessMessage": 'Created "{title}"',
  "home.importProjectFailed": "Failed to import project",
  "home.importWarningsTitle": "Project repaired",
  "home.importWarningsMessage": "Repaired {n} compatibility issue(s)",
  "home.importedSuffix": " (imported)",
  "home.exportProject": "Export project JSON",
  "home.exportProjectSuccess": "Project exported",
  "home.exportProjectSuccessMessage": '"{title}" saved as JSON',
  "home.exportProjectFailed": "Failed to export project",
  "home.projectJsonLabel": "PPT Agent project",

  "preset.library": "Sample Library",
  "preset.enterTopic": "Enter Topic",
  "preset.back": "Back",
  "preset.enterTopicPrompt":
    "Style skeleton selected. Enter your topic and a tailored outline will be generated based on this style.",
  "preset.topicPlaceholder": "Enter a topic, e.g. Q3 business review",
  "preset.generateOutline": "Generate Outline",
  "preset.generateError": "Generation failed, please try again",
  "preset.pageCount": "{count} pages",
  "preset.audience": "For {audience}",
  "preset.audienceHint": "Target audience: {audience}",
  "preset.quarterly-review.name": "Quarterly Business Review",
  "preset.quarterly-review.desc":
    "A management-facing quarterly review covering performance, highlights and gaps, and next-quarter plans.",
  "preset.quarterly-review.audience": "Management",
  "preset.product-launch.name": "Product Launch",
  "preset.product-launch.desc":
    "A launch presentation for market and users, highlighting product value and competitiveness.",
  "preset.product-launch.audience": "Market and users",
  "preset.market-analysis.name": "Market Analysis Report",
  "preset.market-analysis.desc":
    "In-depth market research covering industry trends, competitive landscape, and growth opportunities.",
  "preset.market-analysis.audience": "Decision makers",
  "preset.training-material.name": "Training Deck",
  "preset.training-material.desc":
    "Training material for learners with a clear, progressive structure.",
  "preset.training-material.audience": "Learners",
  "preset.business-plan.name": "Fundraising Business Plan",
  "preset.business-plan.desc":
    "An investor-facing business plan showing the business model, market size, and growth potential.",
  "preset.business-plan.audience": "Investors",
  "preset.competitor-analysis.name": "Competitor Analysis",
  "preset.competitor-analysis.desc":
    "An in-depth comparison of key competitors to identify differentiation and competitive strategy.",
  "preset.competitor-analysis.audience": "Product and strategy teams",
  "preset.project-proposal.name": "Project Proposal",
  "preset.project-proposal.desc":
    "A management-facing proposal that clarifies goals, value, resources, and risks.",
  "preset.project-proposal.audience": "Review committee",
  "preset.annual-plan.name": "Annual Plan",
  "preset.annual-plan.desc":
    "Annual strategy breakdown aligning goals, initiatives, resources, and safeguards.",
  "preset.annual-plan.audience": "Management and all staff",
  "preset.quarterly-pyramid-swiss.name":
    "Quarterly Review · Conclusion First · Swiss Minimal",
  "preset.product-narrative-darktech.name":
    "Product Story · Narrative Tension · Dark Tech",
  "preset.training-instructional-soft.name":
    "New-Hire Training · Instructional · Soft Rounded",
  "preset.briefing-editorial-orange.name":
    "Market Weekly · Neutral Briefing · Editorial",
  "preset.architecture-pyramid-blueprint.name":
    "Architecture Review · Conclusion First · Blueprint",
  "preset.launch-showcase-glass.name":
    "Product Launch · Showcase Minimal · Glassmorphism",
  "preset.guide-instructional-swiss.name":
    "How-To Guide · Instructional · Swiss Minimal",

  "editor.projectNotFound": "Project not found",
  "editor.projectNotFoundMessage":
    "The project you tried to load does not exist. A new project will be created instead.",
  "editor.pagesStaleTitle": "Some pages have changed",
  "editor.pagesStaleMessage":
    '{n} page(s) were edited but not re-rendered. The export will contain outdated visuals; consider clicking "Sync stale pages" first.',
  "editor.syncStale": "Sync stale pages ({n})",
  "editor.syncingStale": "Syncing…",
  "editor.syncStaleJob": "Sync stale pages",
  "editor.syncStaleProgress": "Syncing page {current}/{total}",
  "editor.syncStaleDone": "Stale pages synced",
  "editor.syncStaleDoneMessage": "Updated visuals for {n} page(s)",
  "editor.syncStaleFailed": "Failed to sync stale pages",
  "editor.annotating": "AI editing element",
  "editor.annotateApplied": "Element updated",
  "editor.annotateFailed": "AI element edit failed",
  "editor.exportJob": 'Export "{title}"',
  "editor.exportSuccess": "Export succeeded",
  "editor.exportDownloaded": "File downloaded to your device",
  "editor.exportSaved": "{n} page(s) saved",
  "editor.exportFailed": "Export failed",
  "editor.untitled": "Untitled project",
  "editor.pageCount": "{n} page(s)",
  "editor.activeJobsCount": "{n} task(s)",
  "editor.failedJobsCount": "{n} failed task(s)",
  "editor.outlinePanel": "Outline panel",
  "editor.aiPanel": "AI panel",
  "editor.deleteProject": "Delete project",
  "editor.design": "Design",
  "editor.import": "Import",
  "editor.presentTooltip": "Present (F5)",
  "editor.present": "Present",
  "editor.qualityBlockExport":
    "Serious quality issues exist. Fix them before exporting.",
  "editor.qualityNotMet": "Quality not met",
  "editor.taskList": "Task list",
  "editor.clearCompleted": "Clear completed",
  "editor.statusRunning": "In progress",
  "editor.statusFailed": "Failed",
  "editor.statusSucceeded": "Completed",
  "editor.copyError": "Copy error",
  "editor.expandOutline": "Expand outline",
  "preview.textContent": "Text",
  "preview.fontSize": "Font size (px)",
  "preview.fill": "Fill color",
  "preview.nudgeHint":
    "Drag to move · Arrow keys nudge (Shift ×10) · Right-click to pick overlapping elements · Esc to deselect",
  "preview.editMode": "Edit on canvas",
  "preview.exitEditMode": "Exit editing",
  "preview.aiEditPlaceholder": "Describe how to change this element…",
  "preview.aiEditSubmit": "AI edit this element",
  "editor.previewPlaceholder":
    "The preview will appear here once an outline is generated",
  "editor.expandAiPanel": "Expand AI panel",
  "editor.deleteConfirmMessage":
    'Are you sure you want to delete "{title}"? This action cannot be undone.',

  "chat.welcome":
    "Hi! I can help you generate a PPT outline and edit content. What topic do you want your PPT on?",
  "chat.applyFailed": "Failed to apply changes: {error}",
  "chat.applied": "Changes applied: {changes}",
  "chat.autoFixedSome": "Some fixable issues have been auto-fixed, ",
  "chat.hardIssuesRemain":
    "There are still {count} serious issue(s) that need manual handling, and export is blocked: {issues}",
  "chat.autoFixedAll": "Fixable issues have been auto-fixed.",
  "chat.noAutoFix": "No auto-fixable issues found.",
  "chat.researching": "Searching the web for source material…",
  "chat.researchDone":
    "Found {n} web source(s); using them as source material.",
  "chat.researchFailed": "Web research failed, continuing without it: {error}",
  "chat.generatingOutline": "Generating outline, please wait…",
  "chat.generateOutline": "Generate outline",
  "chat.firstPageGateFailed": "First-page style check failed: {issues}",
  "chat.outlineGenerated":
    "Generated a {count}-page outline! You can:\n1. Drag to reorder in the left outline panel\n2. Click each page to expand and edit title and layout\n3. Tell me what else to adjust",
  "chat.analyzing": "Analyzing your request…",
  "chat.apply": "Apply changes",
  "chat.localFallbackHandled": "Handled with local rules",
  "chat.localFallbackNote": "(Handled with local rules, no AI call)",
  "chat.noChangesNeeded":
    "Based on your request, there's nothing to change right now.",
  "chat.detectedOps": "Detected {count} operation(s): {title}",
  "chat.highRiskWarning":
    "⚠️ **Contains high-risk operations** (delete/replace/merge pages). Please confirm before applying.",
  "chat.emptyDeck":
    "There's no PPT outline yet. Tell me the topic you want, and I'll generate it for you.",
  "chat.errorWithApiKey":
    "Something went wrong: {error}. Please check that the API Key in Settings is configured correctly.",
  "chat.unknownError": "Unknown error",
  "errorSuggest.apiKey": "Check that your API Key is correct in Settings.",
  "errorSuggest.rateLimit":
    "Too many requests — wait a moment or switch models.",
  "errorSuggest.timeout":
    "Model responded too slowly — retry, pick a faster model, or reduce the page count.",
  "errorSuggest.network":
    "Network issue — check your connection, proxy, or Base URL.",
  "errorSuggest.model": "Model not available — pick another model in Settings.",
  "chat.generateFromTemplateJob": "Generate from template: {name}",
  "chat.regeneratedFromTemplate":
    'Regenerated a {count}-page outline from template "{name}"!',
  "chat.templateFailed": "Template generation failed: {error}",
  "chat.assistantTitle": "AI Assistant",
  "chat.useTemplate": "Generate from template",
  "chat.template": "Template",
  "chat.firstPageCheck": "First-page style check",
  "chat.regenerateFirstPage": "Regenerate first page",
  "chat.continueAfterAdjust": "Continue after adjusting",
  "chat.copyMessage": "Copy message",
  "chat.highRisk": "High-risk operation",
  "chat.thinking": "Thinking…",
  "chat.liveOutput": "Local model live output",
  "chat.suggestionAiIndustry": "Generate a PPT about the AI industry",
  "chat.suggestionQ3Report": "Q3 business report",
  "chat.suggestionLaunch": "Product launch PPT",
  "chat.suggestionMarketAnalysis": "Market analysis report",
  "chat.inputPlaceholder":
    "Type a command, e.g., generate a Q3 business review report",

  "chat.genOptions": "Generation Settings",
  "chat.genOptionsShow": "Options",
  "chat.genOptionsHide": "Hide options",
  "chat.genOptionsScenario": "Scenario",
  "chat.genOptionsTone": "Tone",
  "chat.genOptionsDensity": "Density",
  "chat.genOptionsAudience": "Audience",
  "chat.genOptionsAudiencePlaceholder": "e.g. investors, new hires (optional)",
  "chat.genOptionsCoreMessage": "Core message",
  "chat.genOptionsCoreMessagePlaceholder":
    "One sentence the whole deck must land (optional)",
  "chat.genOptionsCharts": "Charts",
  "chat.genOptionsPageCount": "Pages",
  "chat.genOptionsPageCountPlaceholder": "Auto",
  "chat.genOptionsAuto": "Auto",
  "scenario.businessReview": "Business review",
  "scenario.pitch": "Pitch deck",
  "scenario.training": "Training",
  "scenario.marketAnalysis": "Market analysis",
  "scenario.proposal": "Proposal",
  "scenario.custom": "General",
  "tone.formal": "Formal",
  "tone.consulting": "Consulting",
  "tone.concise": "Concise",
  "tone.storytelling": "Storytelling",
  "density.low": "Low",
  "density.medium": "Medium",
  "density.high": "High",
  "charts.encourage": "Prefer charts",
  "charts.avoid": "Avoid charts",

  "import.jobImportTitle": 'Import "{title}"',
  "import.generatingOutline": "Generating outline…",
  "import.complete": "Import complete",
  "import.generatedPages": "Generated a {count}-page outline",
  "import.failed": "Import failed",
  "import.unsupportedFormat": "Unsupported file format",
  "import.unsupportedFormatMsg": "Only .pdf, .docx and .md files are supported",
  "import.parseFailed": "Parse failed",
  "import.urlUnreachable": "Cannot access this webpage",
  "import.urlUnreachableMsg":
    "This may be due to CORS restrictions or a network issue. Try copying the content and pasting it into a Markdown file to import.",
  "import.strategyDirect": "Generate directly",
  "import.strategyChunk": "Generate after chunked summarization",
  "import.strategySelect": "Generate after selecting sections",
  "import.charCount": "{chars} characters · ~{tokens} tokens",
  "import.strategyAndPages":
    "Strategy: {strategy} · Recommended pages: {pages}",
  "import.selectSections": "Select sections to generate ({selected}/{total})",
  "import.charsShort": "{count} characters",
  "import.reselect": "Reselect",
  "import.generatePpt": "Generate PPT",
  "import.title": "Import document",
  "import.uploadFile": "Upload file",
  "import.webLink": "Web link",
  "import.uploadHint": "Click to upload a file",
  "import.uploadFormats":
    "Supports .pdf, .docx (Word) and .md (Markdown) formats",
  "import.urlNote":
    "Note: some sites may block access (CORS restrictions). We recommend importing via file.",
  "import.parseAndImport": "Parse and import",

  "design.mode": "Mode",
  "design.visualStyle": "Visual Style",
  "design.palette": "Color Palette",
  "design.colorPrimary": "Primary",
  "design.colorSecondary": "Secondary",
  "design.colorAccent": "Accent",
  "design.colorBackground": "Background",
  "design.colorSurface": "Surface",
  "design.colorText": "Text",
  "design.colorTextMuted": "Muted Text",
  "design.deletePalette": "Delete {name}",
  "design.newPalette": "+ New Palette",
  "design.paletteName": "Palette Name",
  "design.canvas": "Canvas format",
  "design.playback": "Playback Effects",
  "design.entranceAnimation":
    "Entrance animation (fade in per object, click to advance)",
  "transition.none": "None",
  "transition.fade": "Fade",
  "transition.push": "Push",
  "transition.wipe": "Wipe",
  "transition.cut": "Cut",
  "canvas.ppt-16-9": "PPT 16:9",
  "canvas.xhs-3-4": "Xiaohongshu 3:4",
  "canvas.square-1-1": "Square 1:1",

  "inspector.tabSlide": "Slide",
  "inspector.tabChart": "Chart",
  "inspector.tabImage": "Image",
  "inspector.tabNotes": "Notes",
  "inspector.generateContentJob": "Generate content: {title}",
  "inspector.batchGenerateJob": "Batch generate content ({count} pages)",
  "inspector.generatePage": "AI Generate This Page",
  "inspector.filling": "Filling…",
  "inspector.fillEmptyPages": "AI Fill All Empty Pages",
  "inspector.selectPage": "Select a page",
  "inspector.layoutCover": "Cover",
  "inspector.layoutSection": "Section",
  "inspector.layoutContent": "Content",
  "inspector.layoutTwoColumn": "Two Columns",
  "inspector.layoutChart": "Chart",
  "inspector.layoutImage": "Image",
  "inspector.layoutClosing": "Closing",
  "inspector.layoutCols2": "2 Columns",
  "inspector.layoutCols3": "3 Columns",
  "inspector.layoutCols4": "4 Columns",
  "inspector.layoutCols5": "5 Columns",
  "inspector.layoutCols6": "6 Columns",
  "inspector.title": "Title",
  "inspector.subtitle": "Subtitle",
  "inspector.layout": "Layout",
  "inspector.body": "Body",
  "inspector.bullets": "Bullets ({count})",
  "inspector.chartBar": "Bar Chart",
  "inspector.chartPie": "Pie Chart",
  "inspector.chartLine": "Line Chart",
  "inspector.chartDoughnut": "Doughnut Chart",
  "inspector.chartEmpty": "This page has no chart.",
  "inspector.chartAdd": "Add Chart",
  "inspector.chartType": "Chart Type",
  "inspector.chartTitle": "Chart Title",
  "inspector.optional": "Optional",
  "inspector.chartData": "Data",
  "inspector.chartAddRow": "+ Add Row",
  "inspector.chartLabel": "Label",
  "inspector.chartDelete": "Delete Chart",
  "inspector.chartNeedsRedraw":
    "This page has no chart area. Changes are saved; click “Sync page” below the preview to render the chart.",
  "inspector.imageFull": "Full",
  "inspector.imageRight": "Right",
  "inspector.imageBackground": "Background",
  "inspector.imageEmpty": "This page has no image.",
  "inspector.imageUrl": "Image URL",
  "inspector.imageAlt": "Alt Text",
  "inspector.imagePosition": "Position",
  "inspector.imageDeleteConfirm": "Delete image?",
  "inspector.imageDelete": "Delete Image",
  "inspector.imageSearch": "Search web images",
  "inspector.imageSearchPlaceholder": "Search keywords, e.g. city skyline",
  "inspector.imageSearchEmpty": "No results found",
  "inspector.imageApplyFailed": "Failed to apply image: {error}",
  "inspector.imageUrlApply": "Apply URL",
  "inspector.imageUrlHint":
    "Supports http(s) or data: image URLs; external images are embedded into the page.",
  "inspector.imageUpload": "Upload local image",
  "inspector.imageUploading": "Processing…",
  "inspector.imageApplying": "Applying…",
  "inspector.imageEmbedded": "Image embedded in page (data URL)",
  "inspector.imageSvgHint":
    "SVG pages embed the image as a full-page background; position only applies to legacy pages without SVG.",
  "inspector.imageAltFallback": "Image",
  "inspector.imageUploadType": "Please choose an image file",
  "inspector.imageTooLarge": "Image exceeds 8 MB; choose another one",
  "inspector.notesHint": "Speaker notes export to PPTX Speaker Notes.",
  "inspector.notesPlaceholder": "Type speaker notes…",

  "outline.title": "Outline",
  "outline.addSlide": "Add Slide",
  "outline.empty":
    "Enter a topic in the right-hand AI chat to generate an outline",
  "outline.pageTitle": "Page Title",
  "outline.qHard": "Has critical quality issues",
  "outline.qSoft": "Has suggestions",
  "outline.moveUp": "Move up",
  "outline.moveDown": "Move down",

  "present.empty": "No slides",
  "present.notes": "Speaker Notes",
  "present.notesShortcut": "Notes (N)",
  "present.exitShortcut": "Exit (Esc)",

  "quality.hard": "Critical",
  "quality.soft": "Tip",
  "quality.visualReview": "Visual review (AI sees and fixes)",
  "quality.visualReviewing": "Reviewing pages…",
  "chat.visualReviewJob": "Visual review",
  "chat.visualReviewProgress": "Reviewing page {n}/{total}…",
  "chat.visualReviewDone":
    "Visual review finished: {total} page(s) checked, {fixed} redrawn.",
  "chat.visualReviewFailed":
    "Visual review failed: {error}. Your model may not support image input.",
  "quality.title": "Quality Check",
  "quality.hardCount": "Critical {count}",
  "quality.softCount": "Tip {count}",
  "quality.fixing": "Fixing…",
  "quality.autoFix": "Fix All ({count})",
  "quality.pageContext": "Page {index} “{title}”: ",
  "quality.svg.contractMissingRoot": "Missing <svg> root element",
  "quality.svg.contractMissingViewBox": "svg is missing viewBox",
  "quality.svg.contractBadViewBox":
    "viewBox must be “{required}”, got “{actual}”",
  "quality.svg.contractForbiddenElement": "Forbidden SVG element <{name}>",
  "quality.svg.contractUnsupportedElement": "Unsupported SVG element <{name}>",
  "quality.svg.contractExternalRef":
    "External resource reference is not allowed: {attr}=“{url}”",
  "quality.svg.textOutOfBounds":
    "Text out of bounds: x={x}, y={y}, estimated width={width} exceeds canvas width {canvasW}",
  "quality.svg.textBelowCanvas":
    "Text below canvas: y+height={bottom} ({lineCount} lines × {fontSize}px) > canvas height {canvasH}",
  "quality.svg.textSizeBudget":
    "Text size budget exceeded: estimated width {width} exceeds canvas width {canvasW}",
  "quality.svg.textRightOutsideSafe":
    "Text “{snippet}” reaches x={right}, past the safe area (canvas {canvasW} − margin {safe}): shorten or wrap it",
  "quality.svg.textLeftOutsideSafe":
    "Text “{snippet}” starts at x={left}, outside the safe area (< {limit})",
  "quality.svg.textBottomOutsideSafe":
    "Text “{snippet}” bottom at y={bottom}, past the lower safe area (canvas {canvasH} − {safe})",
  "quality.svg.textOverlap":
    "Text overlap: “{a}” and “{b}” bounding boxes overlap {overlapX}×{overlapY}px — adjust spacing or shorten",
  "quality.svg.elementLeftOut": "Element out of bounds: left edge x={x} < 0",
  "quality.svg.elementTopOut": "Element out of bounds: top edge y={y} < 0",
  "quality.svg.elementRightOut":
    "Element past the right edge: x+width={right} > {canvasW}",
  "quality.svg.elementBottomOut":
    "Element past the bottom edge: y+height={bottom} > {canvasH}",
  "quality.svg.typographyOffAnchor":
    "Font size off anchor: {sizes}px is outside anchors {anchors} ±{tolerance}px ({count} places) — use the anchor sizes",
  "quality.svg.chartInvalidType":
    "Invalid chart type: data-chart-type=“{type}” (supported: {supported})",
  "quality.svg.chartMissingData":
    "Chart has no data: data-chart-data not provided ({type} charts cannot be exported)",
  "quality.svg.chartInvalidJson":
    "Invalid chart JSON: data-chart-data cannot be parsed ({type} charts cannot be exported)",
  "quality.svg.chartEmptyData":
    "Empty chart data: data-chart-data must be a non-empty array of label/value ({type} charts cannot be exported)",
  "quality.svg.chartMissingMarker":
    "Chart missing: this page calls for a {type} chart, but no data-chart-type marker appears in the SVG",
  "quality.svg.chartBarCountMismatch":
    "Bar geometry mismatch: drew {bars} bars but the data has {points} points — redraw",
  "quality.svg.chartBarRatioMismatch":
    "Bar geometry distorted: bar {index} height ratio {barPercent}% differs from value ratio {valuePercent}% by more than 12% — recompute the bar heights",
  "quality.svg.contentMissingTitle":
    "Content missing: title “{title}” does not appear in the SVG text",
  "quality.svg.contentMissingBullet":
    "Content missing: bullet “{bullet}” does not appear in the SVG text",
  "quality.svg.contentMissingSnippet":
    "Content missing: key fragment “{snippet}” does not appear in the SVG text",
  "quality.svg.cohortColorOffLock":
    "Colour off-lock: used colours outside the design lock {colors} — only palette colours are allowed",
  "quality.svg.cohortFontOffLock":
    "Font off-lock: used {fonts} — only {allowed} are allowed",
  "quality.svg.shapeInvalidPreset":
    "Invalid preset shape: data-prst=“{id}” is not supported ({supported})",
  "quality.svg.iconUnknown":
    "Unknown icon: data-icon=“{id}” is not in the icon library ({supported})",
  "quality.svg.aestheticsBrandContrast":
    "Palette combination fails: token #{fg} text on #{bg} has contrast {ratio} < {min} — this is a deck-wide design issue, repainting page by page will not help; swap the text/background token in the design panel",
  "quality.svg.aestheticsLowContrast":
    "Contrast too low: text (#{fg}) on its background (#{bg}) has contrast {ratio} < {min} — pick a stronger pair from the palette, add a background/surface scrim, or raise the font size to ≥26px",
  "quality.svg.aestheticsAccentArea":
    "Accent colour covers {percent}% of the canvas, above the 10% cap of the 60-30-10 rule — accent is for highlights only, use background/surface for large areas",
  "quality.svg.aestheticsMissingBackground":
    "Page has no large background fill (background {background} covers <40%) — the page looks unanchored",
  "quality.svg.aestheticsShadowOpacity":
    "Shadow opacity flood-opacity={value} is outside the 0.03–0.12 range — too heavy, lighten it",
  "quality.svg.aestheticsPaletteContrast":
    "Palette token combination “{fgToken} {fg}” on “{bgToken} {bg}” has contrast {ratio} < 4.5 — every page using it looks washed out; darken the text or brighten the background in the design panel",
  "quality.svg.balanceBottomGap":
    "Layout imbalance: the bottom {percent}% is empty and all content is piled in the upper half — increase spacing or move the visual centre down",
  "quality.svg.balanceLeftAlignment":
    "Left-edge fragmentation: {count} different left edges ({lefts}px) — snap the text to one column x (e.g. margin 40)",
  "quality.svg.rhythmCjkLetterSpacing":
    "CJK letter spacing too large: letter-spacing={spacing} is {percent}% of font size {fontSize} (>5%) — Chinese needs no letter spacing, remove it",
  "quality.svg.rhythmLeftDrift":
    "Left-edge drift: same-size text “{a}” and “{b}” differ by {delta}px (≥4 and ≤24) — they look like one column but are not aligned; snap them to the same x",
  "quality.svg.rhythmGridSpacing":
    "Uneven card spacing: {count} cards in the same row differ by {percent}% — distribute the x spacing evenly",
  "quality.deck.missingCover":
    "The first page is not a cover layout, or its title is empty",
  "quality.deck.missingClosing": "The last page is not a closing layout",
  "quality.deck.duplicateTitle":
    "Title “{title}” is duplicated on another page",
  "quality.deck.tooManyBullets":
    "Page “{title}” has more than 7 top-level bullets ({count} in total)",
  "quality.deck.emptyChart": "Page “{title}” has a chart with no data",
  "quality.deck.missingImage":
    "Page “{title}” uses an image layout but has no image",
  "quality.deck.twoColumnIncomplete":
    "Page “{title}” uses a two-column layout but has fewer than two columns",
  "quality.deck.genericTitle":
    "Page “{title}” has a vague title — add a subtitle or a more specific title",
  "quality.deck.chartUnverified":
    "Page “{title}” shows chart values {values} that were not found in the source material — check whether they were fabricated",
  "quality.deck.pageCountMismatch":
    "Expected {expected} pages, got {actual} (off by {diff})",
  "quality.deck.templateNeedsChart":
    "This template requires at least one chart page",
  "quality.deck.pyramidTitle":
    "Conclusion-first mode requires the first-page title to be a conclusion",

  "redraw.failed": "Slide redraw failed",
  "redraw.redrawing": "Redrawing…",
  "redraw.sync": "Redraw Sync",
  "redraw.page": "Redraw Page",

  "job.unknownError": "Unknown error",
  "job.cancelled": "Task cancelled",
  "job.networkError": "Network error: {raw}",
  "job.parseError": "Result parse failed: {raw}",
  "job.modelError": "Model call failed: {raw}",

  "mode.pyramid": "Conclusion First",
  "mode.pyramid.bestFor": "Decision-making / analysis / reporting",
  "mode.narrative": "Story Arc",
  "mode.narrative.bestFor": "Pitch / case study / brand",
  "mode.instructional": "Instructional",
  "mode.instructional.bestFor": "Training / tutorial / education",
  "mode.showcase": "Visual Impact",
  "mode.showcase.bestFor": "Launch / brand showcase",
  "mode.briefing": "Briefing",
  "mode.briefing.bestFor": "Weekly report / status / reference",
  "mode.custom": "Custom",
  "mode.custom.bestFor": "Mixed intent",

  "style.swiss-minimal": "Swiss Minimal",
  "style.swiss-minimal.character":
    "Strict grid, sharp geometry, zero ornament, aggressive whitespace; zero corner radius; no gradients or shadows; contrasted weights (900/300) rather than font contrast; the primary color occupies only a tiny area.",
  "style.dark-tech": "Dark Tech",
  "style.dark-tech.character":
    "Dark canvas, glowing accent, geometric precision; small corner radius (≤4); subtle glow without abusing shadows; data-dense with lines and grids.",
  "style.soft-rounded": "Soft Rounded",
  "style.soft-rounded.character":
    "Rounded cards (≥12), light shadow, approachable; moderate whitespace; fits product/SaaS/training.",
  "style.editorial": "Editorial",
  "style.editorial.character":
    "Magazine hierarchy, columns and rules, serif/sans mix; strong rhythm; restrained whitespace.",
  "style.blueprint": "Blueprint",
  "style.blueprint.character":
    "Schematic lines on dark paper, isometric diagrams, annotations; geometric precision; fits technology/architecture.",
  "style.glassmorphism": "Glassmorphism",
  "style.glassmorphism.character":
    "Translucent glass panels, gradient light, floating depth; large corner radius (≥16); fits modern SaaS/launch.",
  "style.magazine-bold": "Magazine Bold",
  "style.magazine-bold.character":
    "Oversized headline dominates the canvas, extreme weight contrast, flat color blocks; type IS the graphic, minimal decoration.",
  "style.ink-wash": "Ink Wash",
  "style.ink-wash.character":
    "Rice-paper background, ink-tone text, whitespace as composition; hairline separators, one cinnabar seal accent; serif titles, airy rhythm.",
  "style.pastel-soft": "Pastel Soft",
  "style.pastel-soft.character":
    "Low-saturation pastels, big rounded (≥20) soft cards, no hard shadows; generous spacing, friendly tone for explainers/training.",
  "style.data-dense": "Data Dense",
  "style.data-dense.character":
    "Density first: multi-column small type, thin grid tables, footnote-level sources; decoration yields to data alignment and scales.",
  "style.nature-calm": "Nature Calm",
  "style.nature-calm.character":
    "Sage-green naturals, gentle sectioning, generous whitespace; low-contrast and easy on the eyes for long-form readouts.",
  "style.mono-luxury": "Mono Luxury",
  "style.mono-luxury.character":
    "Near black-and-white grayscale, hairlines with vast whitespace, wide letter spacing; restrained and cold, for brand/launch contexts.",

  "palette.business-blue": "Business Blue",
  "palette.minimal-white": "Minimal White",
  "palette.tech-purple": "Tech Purple",
  "palette.vibrant-orange": "Vibrant Orange",
  "palette.magazine-crimson": "Magazine Crimson",
  "palette.ink-xuan": "Ink on Xuan Paper",
  "palette.pastel-dream": "Pastel Dream",
  "palette.consulting-navy": "Consulting Navy",
  "palette.nature-sage": "Nature Sage",
  "palette.mono-noir": "Mono Noir",
  "palette.teal-deep": "Deep Teal",
  "palette.sunset-warm": "Sunset Warm",
} as const;

export type TranslationKey = keyof typeof en;
