// --- KONFIGURASI ---
var SPREADSHEET_ID = '1WduLstFmfvPWhRbClIaInqEKyp1ORjsed-OkR3sU92Q';

// Configuration for Sheet Headers (Schema)
// PENTING: Urutan di sini menentukan urutan kolom di Spreadsheet
var SHEET_CONFIG = {
  'Users': ['id', 'nama', 'username', 'password', 'role'], 
  'Nasabah': ['id_nasabah', 'nama', 'nik', 'alamat', 'no_hp', 'simpanan_pokok', 'simpanan_wajib', 'simpanan_sukarela', 'shu', 'koordinator'],
  'Transaksi': ['id_transaksi', 'tanggal', 'id_nasabah', 'jenis_transaksi', 'nominal', 'koordinator', 'keterangan'],
  'Pinjaman': ['id_pinjaman', 'id_nasabah', 'jumlah_pinjaman', 'bunga_persen', 'tenor_bulan', 'angsuran_bulanan', 'sisa_pinjaman', 'status'],
  'Logs': ['id', 'waktu', 'user', 'aktivitas']
};

/**
 * FUNGSI SETUP / INISIALISASI DATABASE
 * Jalankan fungsi ini sekali secara manual dari Editor Apps Script untuk menyiapkan semua sheet.
 */
function setupDatabase() {
  var ss = getSpreadsheet();
  var sheetNames = Object.keys(SHEET_CONFIG);
  var results = [];
  
  sheetNames.forEach(function(name) {
    var sheet = getSheetOrCreate(ss, name);
    results.push(name + " (" + sheet.getLastRow() + " rows)");
  });
  
  Logger.log('Database setup complete: ' + results.join(', '));
  return 'Database setup complete. Sheets: ' + results.join(', ');
}

/**
 * Helper to get a sheet, or create it if it doesn't exist.
 */
function getSheetOrCreate(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var configHeaders = SHEET_CONFIG[sheetName];

  if (!sheet) {
    if (configHeaders) {
      try {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(configHeaders); // Add Headers based on Config
        
        // --- DATA SEEDING (DATA AWAL) ---
        
        if (sheetName === 'Users') {
           // Format: [id, nama, username, password, role]
           sheet.appendRow(['1', 'Super Admin', 'admin', 'admin123', 'admin']);
           sheet.appendRow(['2', 'Koordinator Wilayah 1', 'koor1', 'koor123', 'koordinator']);
           sheet.appendRow(['3', 'Koordinator Wilayah 2', 'koor2', 'koor123', 'koordinator']);
        }
        
        if (sheetName === 'Nasabah') {
           // Format: [id_nasabah, nama, nik, alamat, no_hp, s_pokok, s_wajib, s_sukarela, shu, koordinator]
           // NIK berfungsi sebagai Password untuk Nasabah
           sheet.appendRow(['N001', 'Budi Santoso', '123456', 'Jl. Mawar No. 1', '081234567890', '100000', '50000', '350000', '0', 'koor1']);
           sheet.appendRow(['N002', 'Siti Aminah', '654321', 'Jl. Melati No. 2', '08987654321', '100000', '50000', '850000', '0', 'koor2']);
        }

      } catch (e) {
        sheet = ss.getSheetByName(sheetName);
      }
    }
  } else {
    // Check and Fix Missing Headers (Integrasi Perbaikan)
    checkAndFixHeaders(sheet, configHeaders);
  }
  return sheet;
}

/**
 * Ensures that the physical sheet has all columns defined in SHEET_CONFIG.
 * If a column is missing, it adds it to the header row.
 */
function checkAndFixHeaders(sheet, configHeaders) {
  if (!configHeaders || sheet.getLastRow() === 0) return;

  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var missingHeaders = [];

  for (var i = 0; i < configHeaders.length; i++) {
    if (currentHeaders.indexOf(configHeaders[i]) === -1) {
      missingHeaders.push(configHeaders[i]);
    }
  }

  if (missingHeaders.length > 0) {
    // Append missing headers to the first row
    var startCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function getSpreadsheet() {
  try {
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID') {
       return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  try {
    var params = e.parameter;
    var sheetName = params.sheet;
    
    if (!sheetName) {
      return responseJSON({ status: 'error', message: 'Sheet name required' });
    }

    var ss = getSpreadsheet();
    if (!ss) return responseJSON({ status: 'error', message: 'Spreadsheet inaccessible' });

    var sheet = getSheetOrCreate(ss, sheetName);
    
    if (!sheet) {
      return responseJSON({ status: 'error', message: 'Sheet not found: ' + sheetName });
    }

    var data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return responseJSON({ status: 'success', data: [] });
    }

    var headers = data[0];
    var rows = data.slice(1);
    
    var result = rows.map(function(row) {
      var obj = {};
      headers.forEach(function(header, index) {
        obj[header] = (row[index] === undefined || row[index] === null) ? "" : row[index];
      });
      return obj;
    });

    return responseJSON({ status: 'success', data: result });
  } catch (err) {
    return responseJSON({ status: 'error', message: 'GET Error: ' + err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e.postData) return responseJSON({ error: 'No post data' });
    
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var sheetName = contents.sheet;
    var data = contents.data;
    var id = contents.id;

    var ss = getSpreadsheet();
    var sheet = getSheetOrCreate(ss, sheetName);
    
    if (!sheet) return responseJSON({ error: 'Sheet not found: ' + sheetName });

    // Ensure headers are up to date before writing
    checkAndFixHeaders(sheet, SHEET_CONFIG[sheetName]);

    if (action === 'create') {
      // Get the ACTUAL headers from the sheet to match column order
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      var rowData = headers.map(function(header) {
        // Map data based on header name
        return (data[header] !== undefined) ? data[header] : '';
      });
      
      sheet.appendRow(rowData);
      return responseJSON({ status: 'success', action: 'create' });

    } else if (action === 'update') {
      if (!id) return responseJSON({ error: 'ID required for update' });
      
      var range = sheet.getDataRange();
      var values = range.getValues();
      var headers = values[0];
      var rowIndex = -1;

      // Find row index by ID (Assume ID is in first column or based on Config)
      // Usually first column is ID
      var idColIndex = 0; 

      for (var i = 1; i < values.length; i++) {
        if (String(values[i][idColIndex]) === String(id)) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) return responseJSON({ error: 'ID not found' });

      // Update specific columns
      headers.forEach(function(header, colIndex) {
        if (data.hasOwnProperty(header)) {
           sheet.getRange(rowIndex, colIndex + 1).setValue(data[header]);
        }
      });

      return responseJSON({ status: 'success', action: 'update' });

    } else if (action === 'delete') {
      if (!id) return responseJSON({ error: 'ID required for delete' });
       var values = sheet.getDataRange().getValues();
       for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          return responseJSON({ status: 'success', action: 'delete' });
        }
      }
      return responseJSON({ error: 'ID not found' });
    }

    return responseJSON({ error: 'Invalid action' });

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}