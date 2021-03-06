'use strict'
var electron = require('electron');

// アプリケーション作成用モジュールをロード
var app = electron.app;

// ウィンドウを作成するモジュール
var BrowserWindow = electron.BrowserWindow;

// クラッシュレポート
// require('crash-reporter').start();

// メインウィンドウはGCされないようにグローバル宣言
var mainWindow = null;

// 全てのウィンドウが閉じたら終了
app.on('window-all-closed', function() {
	if (process.platform != 'darwin') {
		app.quit();
	}
});

// Electronの初期化完了後に実行
app.on('ready', function() {
	let data = getConfig();

	// メイン画面の表示。ウィンドウの幅、高さを指定できる
	mainWindow = new BrowserWindow({width: data.WindowWidth, height: data.WindowHeight});
	mainWindow.loadURL('file://' + __dirname + '/index.html');

	// ウィンドウが閉じられたらアプリも終了
	mainWindow.on('closed', function() {
		mainWindow = null;
	});

	installMenu();
});

function getConfig(){
	// デフォルトデータ
	let data = {
		"DataPath": null,
		"WindowWidth": 800,
		"WindowHeight": 480,
		"DispCols": [  "LName", "FName", "JobType", "Companey", "Position", "PostalCode", "Address1", "Address2", "Tel1", "Tel2", "Fax", "EMail", "HomePage"],
	}

	let config = require('fs');
	let dir = app.getPath('userData');
	let path = dir + '/config.json';

	try{
		let config_str = config.readFileSync(path, 'utf-8');
		data = JSON.parse(config_str);
	}
	catch(e){
		//	デバッグ（ディレクトリ存在確認
		//	Application Support/knamecard/は必ず作られるらしい
		//	var util = require('util');
		//	var stat = config.statSync(dir);
		//	console.log("Dir:" + util.inspect(stat));
		data.DataPath =  app.getPath('documents') + "/NameCards.json";

		// デフォルトファイルを作成する
		let str = JSON.stringify(data, null, '\t');
		config.writeFileSync(path, str, null);
	}
	return data;
}

/**
 *	メニュー一覧取得
 *	@private
 */
function getMenuList() {

	return [
		{
			label: 'KNameCard',
			submenu: [
				{
					label: switchCharactersByOS('Quit', '&Quit'),
					accelerator: switchCharactersByOS('Command+Q', 'Ctrl+Q'),
					click: function () { app.quit(); },
				},
			],
		},

		{
			label: 'File',
			submenu: [
				{
					label: switchCharactersByOS('Open', '&Open'),
					accelerator: switchCharactersByOS('Command+O', 'Ctrl+O'),
					click: function () { mainWindow.webContents.send('open') },
				},
				{
					label: switchCharactersByOS('Append', '&Append'),
					accelerator: switchCharactersByOS('Command+A', 'Ctrl+A'),
					click: function () { mainWindow.webContents.send('append') },
				},
				{
					label: switchCharactersByOS('Save', '&Save'),
					accelerator: switchCharactersByOS('Command+S', 'Ctrl+S'),
					click: function () { mainWindow.webContents.send('save') },
				},
				{
					label: switchCharactersByOS('Save As', '&Save As'),
					accelerator: switchCharactersByOS('Shift+Command+S', 'Shift+Ctrl+S'),
					click: function () { mainWindow.webContents.send('saveAs') },
				},
			],
		},

		{
			label: 'Edit',
			submenu: [
				{
					label: switchCharactersByOS('Toggle Display Cols', '&Toggle Display Cols'),
					accelerator: switchCharactersByOS('Command+D', 'Ctrl+D'),
					click: function () { mainWindow.webContents.send('toggleDisplayColConfig') },
				},
				{
					label: switchCharactersByOS('Toggle Search', '&Toggle Search'),
					accelerator: switchCharactersByOS('Command+F', 'Ctrl+F'),
					click: function () { mainWindow.webContents.send('toggleSearchArea') },
				},
				{ type: 'separator' },
				{
					label: switchCharactersByOS('Copy', '&Copy'),
					accelerator: switchCharactersByOS('Command+C', 'Ctrl+C'),
					click: function(){ mainWindow.webContents.send('copy')},
				},
				{
					label: switchCharactersByOS('Paste', '&Paste'),
					accelerator: switchCharactersByOS('Command+V', 'Ctrl+V'),
					click: function(){ mainWindow.webContents.send('paste')},
				},
			],
		},

		{
			label: 'View',
			submenu: [
				{
					label: 'Reload',
					accelerator: 'Command+R',
					click: function() { mainWindow.reload(); },
				},
				{
					label: 'Toggle Full Screen',
					accelerator: 'Ctrl+Command+F',
					click: function() { mainWindow.setFullScreen(!mainWindow.isFullScreen()); },
				},
				{
					label: 'Toggle Developer Tools',
					accelerator: 'Alt+Command+I',
					click: function() { mainWindow.toggleDevTools(); },
				},
				{
					label: switchCharactersByOS('Toggle View Mode', '&Toggle View Mode'),
					accelerator: switchCharactersByOS('Command+I', 'Ctrl+I'),
					click: function () { mainWindow.webContents.send('switchDisplayMode') },
				},
			],
		},
	];
}

/**
 *	メニューの作成
 *	@private
 */
function installMenu() {
	let menuList = getMenuList();
	let Menu = electron.Menu;
	let menu = Menu.buildFromTemplate(menuList);
	Menu.setApplicationMenu(menu);
}

/**
 *	WindowsとMacで文字を切り替える
 *	@private
 */
function switchCharactersByOS(forMac, forWin) {
	if (process.platform == 'darwin') {
		return forMac;
	}
	return forWin;
}
