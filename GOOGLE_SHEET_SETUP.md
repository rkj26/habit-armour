# Google Sheet Setup Guide (Coordinate-based)

This guide explains how to connect your **Habit Armour** dashboard to your Google Sheet tracker:
1. **Template Link**: `https://docs.google.com/spreadsheets/d/1ANTtB9WRy_vauvE6R8jx2cTXvdKTJA2NEUgJ2L7kfCA/edit?usp=sharing` (Open this link and click **File** -> **Make a copy** to save it to your own Google Drive).
2. **Your Copied Spreadsheet**: Use the URL of your newly copied spreadsheet for the setup steps below.

---

## 1. Set Up Google Apps Script
1. Open your spreadsheet in Google Sheets.
2. Go to **Extensions** -> **Apps Script** in the top menu.
3. Delete any existing code in the editor (`Code.gs`).
4. Copy and paste the entire script block below:

```javascript
/**
 * Habit Armor Apps Script Endpoint (Coordinate-Based Grid Sync)
 * Maps input data directly to Excel row/column coordinates on WK tabs.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var type = payload.type; // 'morning', 'night', 'weekly', or 'test'
    var date = payload.date; // 'YYYY-MM-DD'
    var data = payload.data;
    
    if (type === 'test') {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Connection successful!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    
    // Parse date into Monday of that week and day index (Monday=1, Sunday=7)
    var weekInfo = getWeekDetails(date);
    var targetMondayStr = weekInfo.mondayStr; // "DD.MM.YY" format
    var dayIndex = weekInfo.dayIndex; // 1 to 7
    
    // Monday = Column B (index 2), Tuesday = Column C (index 3), ..., Sunday = Column H (index 8)
    var colIndex = dayIndex + 1; 
    
    // Find the sheet tab matching the week commencing date in C2
    var sheets = doc.getSheets();
    var sheet = null;
    
    for (var i = 0; i < sheets.length; i++) {
      var s = sheets[i];
      if (s.getName() === "Template Wk 1") continue;
      
      var c2Val = s.getRange("C2").getValue();
      var c2Str = "";
      if (c2Val instanceof Date) {
        c2Str = formatDate(c2Val);
      } else {
        c2Str = String(c2Val).trim();
      }
      
      if (c2Str === targetMondayStr) {
        sheet = s;
        break;
      }
    }
    
    // If no sheet tab matches this week, duplicate Template Wk 1
    if (!sheet) {
      var template = doc.getSheetByName("Template Wk 1");
      if (!template) {
        // Fallback to the first sheet in document
        template = sheets[0];
      }
      
      // Calculate WK index
      var wkCount = 1;
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getName().indexOf("WK ") === 0) {
          wkCount++;
        }
      }
      var newName = "WK " + wkCount;
      sheet = template.copyTo(doc);
      sheet.setName(newName);
      
      // Set the week commencing date cell in C2
      sheet.getRange("C2").setValue(targetMondayStr);
    }
    
    // Write/update journal entry in Google Doc if provided
    if (data.journalEntry && payload.googleDocId) {
      try {
        var docId = getDocId(payload.googleDocId);
        if (docId) {
          var gdoc = DocumentApp.openById(docId);
          var body = gdoc.getBody();
          
          // Determine headers based on day of week
          var dateParts = date.split('-');
          var yr = parseInt(dateParts[0], 10);
          var mo = parseInt(dateParts[1], 10) - 1;
          var dy = parseInt(dateParts[2], 10);
          var dateObj = new Date(yr, mo, dy);
          var dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
          var headingText = "";
          
          if (type === 'morning') {
            if (dayOfWeek === 6) headingText = "Saturday Log — Weekend Recharge";
            else if (dayOfWeek === 0) headingText = "Sunday Log — Start of Week Goals";
            else headingText = "Morning Log — Daily Goals & Intentions";
          } else if (type === 'night') {
            if (dayOfWeek === 6) headingText = "Saturday Log — Weekly Retrospective";
            else if (dayOfWeek === 0) headingText = "Sunday Log — Weekly Prep";
            else headingText = "Night Log — Daily Review";
          }
          
          var sectionTitle = "=== " + date + " - " + headingText.toUpperCase() + " ===";
          
          // Check if this header already exists to avoid duplicates
          var found = false;
          var paragraphs = body.getParagraphs();
          for (var p = 0; p < paragraphs.length; p++) {
            if (paragraphs[p].getText() === sectionTitle) {
              if (p + 1 < paragraphs.length) {
                paragraphs[p + 1].setText(data.journalEntry);
                found = true;
                break;
              }
            }
          }
          
          if (!found) {
            body.appendParagraph("");
            var headerP = body.appendParagraph(sectionTitle);
            headerP.setHeading(DocumentApp.ParagraphHeading.HEADING3);
            body.appendParagraph(data.journalEntry);
          }
        }
      } catch (docErr) {
        console.error("Google Doc sync failed: " + docErr.toString());
      }
    }
    
    // Map morning logs
    if (type === 'morning') {
      if (data.wakingWeight !== undefined && data.wakingWeight !== "") {
        sheet.getRange(35, colIndex).setValue(parseFloat(data.wakingWeight));
      }
      if (data.sleepHours !== undefined && data.sleepHours !== "") {
        sheet.getRange(15, colIndex).setValue(parseFloat(data.sleepHours));
      }
      if (data.sleepQualitySelf !== undefined) {
        sheet.getRange(16, colIndex).setValue(parseInt(data.sleepQualitySelf, 10));
      }
      if (data.sleepQualityDevice !== undefined) {
        sheet.getRange(17, colIndex).setValue(parseInt(data.sleepQualityDevice, 10));
      }
      if (data.energyLevels !== undefined) {
        sheet.getRange(7, colIndex).setValue(parseInt(data.energyLevels, 10));
      }
      if (data.mood !== undefined) {
        sheet.getRange(8, colIndex).setValue(parseInt(data.mood, 10));
      }
      if (data.stress !== undefined) {
        sheet.getRange(9, colIndex).setValue(parseInt(data.stress, 10));
      }
      if (data.illnessSigns !== undefined) {
        sheet.getRange(10, colIndex).setValue(parseInt(data.illnessSigns, 10));
      }
      if (data.muscleSoreness !== undefined) {
        sheet.getRange(11, colIndex).setValue(parseInt(data.muscleSoreness, 10));
      }
      if (data.restingHR !== undefined && data.restingHR !== "") {
        sheet.getRange(12, colIndex).setValue(parseInt(data.restingHR, 10));
      }
      if (data.bloodPressure !== undefined && data.bloodPressure !== "") {
        sheet.getRange(13, colIndex).setValue(data.bloodPressure);
      }
    } 
    // Map night logs
    else if (type === 'night') {
      if (data.calories !== undefined && data.calories !== "") {
        sheet.getRange(19, colIndex).setValue(parseInt(data.calories, 10));
      }
      if (data.protein !== undefined && data.protein !== "") {
        sheet.getRange(20, colIndex).setValue(parseInt(data.protein, 10));
      }
      if (data.carbs !== undefined && data.carbs !== "") {
        sheet.getRange(21, colIndex).setValue(parseInt(data.carbs, 10));
      }
      if (data.fats !== undefined && data.fats !== "") {
        sheet.getRange(22, colIndex).setValue(parseInt(data.fats, 10));
      }
      if (data.foodQuality !== undefined) {
        sheet.getRange(23, colIndex).setValue(parseInt(data.foodQuality, 10));
      }
      if (data.waterConsumed !== undefined && data.waterConsumed !== "") {
        sheet.getRange(24, colIndex).setValue(parseFloat(data.waterConsumed));
      }
      if (data.alcoholConsumed !== undefined) {
        sheet.getRange(25, colIndex).setValue(data.alcoholConsumed === 'Yes');
      }
      if (data.hunger !== undefined) {
        sheet.getRange(26, colIndex).setValue(parseInt(data.hunger, 10));
      }
      if (data.digestiveStress !== undefined) {
        sheet.getRange(27, colIndex).setValue(parseInt(data.digestiveStress, 10));
      }
      if (data.supplements !== undefined) {
        sheet.getRange(28, colIndex).setValue(parseInt(data.supplements, 10));
      }
      if (data.trainingDay !== undefined) {
        sheet.getRange(30, colIndex).setValue(data.trainingDay === 'Yes');
      }
      if (data.strengthPerformance !== undefined) {
        sheet.getRange(31, colIndex).setValue(data.trainingDay === 'No' ? "" : parseInt(data.strengthPerformance, 10));
      }
      if (data.steps !== undefined && data.steps !== "") {
        sheet.getRange(32, colIndex).setValue(parseInt(data.steps, 10));
      }
      if (data.cardioPerformed !== undefined) {
        sheet.getRange(33, colIndex).setValue(data.cardioPerformed === 'Yes');
      }
    } 
    // Map weekly specs
    else if (type === 'weekly') {
      if (data.startWeight !== undefined && data.startWeight !== "") {
        sheet.getRange("F2").setValue(parseFloat(data.startWeight));
      }
      if (data.responseAction !== undefined && data.responseAction !== "") {
        sheet.getRange("I2").setValue(data.responseAction);
      }
      if (data.umbilical !== undefined && data.umbilical !== "") {
        sheet.getRange("C36").setValue(parseFloat(data.umbilical));
      }
      if (data.bicepL !== undefined && data.bicepL !== "") {
        sheet.getRange("E36").setValue(parseFloat(data.bicepL));
      }
      if (data.bicepR !== undefined && data.bicepR !== "") {
        sheet.getRange("E37").setValue(parseFloat(data.bicepR));
      }
      if (data.quadL !== undefined && data.quadL !== "") {
        sheet.getRange("G36").setValue(parseFloat(data.quadL));
      }
      if (data.quadR !== undefined && data.quadR !== "") {
        sheet.getRange("G37").setValue(parseFloat(data.quadR));
      }
      if (data.glutes !== undefined && data.glutes !== "") {
        sheet.getRange("I36").setValue(parseFloat(data.glutes));
      }
      if (data.chest !== undefined && data.chest !== "") {
        sheet.getRange("I37").setValue(parseFloat(data.chest));
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Sheet updated successfully!" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper to determine week commencing Monday and Monday/Sunday indices
function getWeekDetails(dateStr) {
  var parts = dateStr.split('-');
  var yr = parseInt(parts[0], 10);
  var mo = parseInt(parts[1], 10) - 1;
  var dy = parseInt(parts[2], 10);
  
  var date = new Date(yr, mo, dy);
  var day = date.getDay(); // 0 = Sunday, 1 = Monday...
  
  var dayIndex = day === 0 ? 7 : day;
  
  var mondayDate = new Date(date);
  var diff = day === 0 ? -6 : 1 - day;
  mondayDate.setDate(date.getDate() + diff);
  
  return {
    dayIndex: dayIndex,
    mondayDate: mondayDate,
    mondayStr: formatDate(mondayDate)
  };
}

// Format date into DD.MM.YY
function formatDate(d) {
  var dd = ("0" + d.getDate()).slice(-2);
  var mm = ("0" + (d.getMonth() + 1)).slice(-2);
  var yy = String(d.getFullYear()).slice(-2);
  return dd + "." + mm + "." + yy;
}

// Extract Google Doc ID from URL or return raw ID
function getDocId(urlOrId) {
  if (!urlOrId) return null;
  if (urlOrId.indexOf("docs.google.com/document/d/") !== -1) {
    var parts = urlOrId.split("/document/d/");
    if (parts.length > 1) {
      return parts[1].split("/")[0];
    }
  }
  return urlOrId.trim();
}
```

5. Save the code (`Cmd+S` / `Ctrl+S`).

## 2. Deploy as Web App
1. Click **Deploy** -> **New deployment**.
2. Click the gear icon and choose **Web app**.
3. Set **Execute as** to `Me` and **Who has access** to `Anyone`.
4. Click **Deploy**.
5. Copy the **Web app URL** and paste it into Habit Armor's settings tab.
