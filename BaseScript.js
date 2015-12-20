'use strict'

var KNameCard = KNameCard || {
	DispMode: "View",		// View：表示、Input：入力
	ResizeTimer: false,		// ウィンドウサイズ変更処理のためのタイマ
	Config: null,			// 設定ファイルオブジェクト
	Cards: null,			// 名刺データオブジェクト
	EntryList: [
		{"Name":"LName",		"Title":"姓"},
		{"Name":"FName",		"Title":"名"},
		{"Name":"JobType",		"Title":"職種"},
		{"Name":"Companey",		"Title":"会社"},
		{"Name":"Position",		"Title":"役職"},
		{"Name":"PostalCode",	"Title":"〒"},
		{"Name":"Address1",		"Title":"住所1"},
		{"Name":"Address2",		"Title":"住所2"},
		{"Name":"Tel1",			"Title":"電話"},
		{"Name":"Tel2",			"Title":"携帯"},
		{"Name":"Fax",			"Title":"FAX"},
		{"Name":"EMail",		"Title":"EMail"},
		{"Name":"HomePage",		"Title":"ホームページ"},
	],
	SortOrder:{},
};

var electron = require('electron');
var app = electron.remote.require('app');
var fs = electron.remote.require('fs');
var browserWindow = electron.remote.require('browser-window');
var dialog = electron.remote.require('dialog');
var clipboard = require('electron').remote.clipboard;

/******************************************************************************
 *	内部処理
 *****************************************************************************/
/**
 *	設定ファイルを読み込む
 */
KNameCard.readConfigFile = function(){
	var config_str = fs.readFileSync(app.getPath('userData') + '/config.json', 'utf-8');
	KNameCard.Config = JSON.parse(config_str);
	//console.log(KNameCard.Config);

	return ;
}

/**
 *	設定ファイルを保存する
 */
KNameCard.writeConfigFile = function(){
	var data = JSON.stringify(KNameCard.Config, null, '\t');
	fs.writeFileSync(app.getPath('userData') + '/config.json', data, null);
}

/**
 *	名刺データJSONの形式が正しいかをチェックする
 *	return true:正しい。false:違う。
 */
KNameCard.checkNameCardFormat = function(data){
	// オブジェクトがnullか必要な項目が無い
	if ((!data) || (!data.Discription) || (!data.CardList)) {
		return  false;
	}

	// チェック文字列が無い
	if (data.Discription != "NameCardList") {
		return  false;
	}

	// 名刺リストが配列で無い
	if (!Array.isArray(data.CardList)) {
		return false;
	}

	return true;
}


/**
 *	名刺データの正当性を検証する。
 *	不当な場合はからデータを作成して返す。
 *	data：名刺データ
 */
KNameCard.checkNameCard = function(data){
	var DefaultCards = {
			"Discription": "NameCardList",
			"CardList": [],
	};

	if (KNameCard.checkNameCardFormat(data)) {
		return data;
	}
	else{
		return DefaultCards;
	}
}

/**
 *	既存の名刺一覧を読み込む
 */
KNameCard.readNameCards = function(file){
	if (!KNameCard.Config.DataPath) {
		KNameCard.Config.DataPath = app.getPath('userData') + "NameCards.json";
	}
	if (!file) {
			file = KNameCard.Config.DataPath;
	}

	var data;
	try{
		var list = fs.readFileSync(file, 'utf-8');
		data = JSON.parse(list);
	}
	catch(e){
		data = null;
	}

	KNameCard.Cards = KNameCard.checkNameCard(data);

	return;
}

/**
 *	名刺データを保存する
 */
KNameCard.writeNameCards = function(file){
	if (!file) {
		file = KNameCard.Config.DataPath;
	}

	var data = JSON.stringify(KNameCard.Cards, null, '\t');
	fs.writeFileSync(file, data, null, function (err) {
		console.log(err);
	});
}

/******************************************************************************
 *	名刺データ表示
 *****************************************************************************/

/**
 *	削除ボタン追加
 */
KNameCard.addDelButtonToRow = function(tr){
	// 削除ボタン
	var del_td = document.createElement("td");
	var del_btn = document.createElement("button");

	del_btn.innerHTML = "×";
	del_btn.onclick = KNameCard.delAndShow;

	del_td.appendChild(del_btn);
	tr.appendChild(del_td);

	return;
}

/**
 *	表のヘッダを作成する
 *	mode： Input（入力モード）、View（表示モード）
 */
KNameCard.createListTitle = function(mode){
	var title = document.getElementById('NameCardHeader');

	for(let i=title.childNodes.length-1; i>=0; i--){
		title.removeChild(title.childNodes[i]);
	}
	var tr = document.createElement("tr");

	// 削除欄を追加
	if (mode == 'Input') {
		var del_td = document.createElement("th");
		tr.appendChild(del_td);
	}

	for(let i=0; i<KNameCard.EntryList.length; i++){
		var col = KNameCard.EntryList[i].Name;	// 設定項目

		// 表示モードの時は表示対象項目だけを表示する
		if ((mode == 'View') && (KNameCard.Config.DispCols.indexOf(col) < 0)) {
			continue;
		}

		var th = document.createElement("th");
		th.innerHTML = KNameCard.EntryList[i]["Title"];

		// 表示モードの時はソート用のハンドラなどを設定する
		if(mode == 'View'){
			th.setAttribute("id", "Col" + col);
			th.style.cursor = "pointer";
			th.onclick = KNameCard.clickToSort;
		}

		tr.appendChild(th);
	}

	title.appendChild(tr);
	return;
}

/**
 *	表示モードで<tr>要素を作成して返す。
 *	id：名刺リストの何番目の要素か
 *	value：値
 */
KNameCard.createCardEntryView = function(id, value){
	var tr = document.createElement("tr");
	tr.setAttribute("id", "CardNo"+id);

	// 項目
	for(var i=0; i<KNameCard.EntryList.length; i++){
		var col = KNameCard.EntryList[i].Name;	// 設定項目

		// 表示対象項目だけを表示する
		if (KNameCard.Config.DispCols.indexOf(col) < 0) {
			continue;
		}

		var td = document.createElement("td");
		td.setAttribute("Class", col);

		var val = value[col];
		var txt = document.createTextNode(val);
		td.appendChild(txt);

		// 地図用ボタン
		if ((col == "Address1") && (val)) {
			var btn = document.createElement("button");
			btn.innerHTML = "地図";
			btn.value = val;
			btn.setAttribute("class", "MapButton");
			btn.onclick = KNameCard.clickMapButton;
			td.appendChild(btn);
		}

		tr.appendChild(td);
	}

	return tr;
}

/**
 *	入力用に<tr>要素を作成して返す。
 *	id：名刺リストの何番目の要素か
 *	value：値
 */
KNameCard.createCardEntryInput = function(id, value){
	var tr = document.createElement("tr");
	tr.setAttribute("id", "CardNo"+id);

	// 削除ボタン追加
	KNameCard.addDelButtonToRow(tr);

	// 項目
	for(var i=0; i<KNameCard.EntryList.length; i++){
		var col = KNameCard.EntryList[i].Name;	// 設定項目

		var td = document.createElement("td");
		td.setAttribute("Class", col);
		var input = document.createElement("input");
		input.setAttribute("type", "text");
		input.setAttribute("class", "ListInput " + col);

		var val = value[col];
		var txt = document.createTextNode(val);
		input.appendChild(txt);
		input.value = val;
		input.onchange = KNameCard.changeInput;
		td.appendChild(input);
		tr.appendChild(td);
	}

	return tr;
}

/**
 *	入力用名刺一覧を表示する
 *	mode：Input（入力用）、View（表示用）
 *	data：表示するデータのリスト（未指定時は全部のリスト）
 */
KNameCard.createList = function(mode, data){
	if (!data) {
		data = KNameCard.Cards.CardList;
	}

	var list = document.getElementById('NameCardBody');

	for(let i=list.childNodes.length-1; i>=0; i--){
		list.removeChild(list.childNodes[i]);
	}

	for(let i=0; i<data.length; i++){
		var tr;
		if (mode == 'Input') {
			tr = KNameCard.createCardEntryInput(i, data[i]);
		}
		else{
			tr = KNameCard.createCardEntryView(i, data[i]);
		}
		list.appendChild(tr);
	}

	return;
}

/**
 *	入力用の空行を最後に追加する。
 *	KNameCard.Cards.CardListには要素がないので注意。
 */
KNameCard.appendInputField = function(){
	var id = KNameCard.Cards.CardList.length;

	var list = document.getElementById('NameCardBody');
	var tr = document.createElement("tr");
	tr.setAttribute("id", "CardNo"+id);

	// 削除ボタン追加
	KNameCard.addDelButtonToRow(tr);

	for(var i=0; i<KNameCard.EntryList.length; i++){
		var col = KNameCard.EntryList[i].Name;	// 設定項目

		var td = document.createElement("td");
		td.setAttribute("Class", col);
		var input = document.createElement("input");
		input.setAttribute("type", "text");
		input.setAttribute("class", "ListInput " + col);
		input.onchange = KNameCard.changeInput;

		td.appendChild(input);
		tr.appendChild(td);
	}

	list.appendChild(tr);
	return;
}

/**
 *	入力値変更時処理
 */
KNameCard.changeInput = function(event){
	var elm = event.target;
	var val = elm.value.trim();	// 入力された値

	// 入力値がなければ無視
	if (!val) {
		return;
	}

	// <tr>のIDから要素番号を作る
	var pos_flg = elm.parentNode.parentNode.id;
	var id = parseInt(pos_flg.replace("CardNo", ""));

	// 新規入力時
	if (id == KNameCard.Cards.CardList.length) {
		KNameCard.addNewEntry();
		KNameCard.appendInputField();
	}

	var key = elm.classList[1];
	KNameCard.Cards.CardList[id][key] = val;

	return;
}

/**
 *	新規要素を追加する
 */
KNameCard.addNewEntry = function(){
	var obj = {
			"LName":"",
			"FName":"",
			"JobType":"",
			"Companey":"",
			"Position":"",
			"PostalCode":"",
			"Address1":"",
			"Address2":"",
			"Tel1":"",
			"Tel2":"",
			"Fax":"",
			"EMail":"",
			"HomePage":"",
	}

	KNameCard.Cards.CardList.push(obj);
	return;
}

/**
 *	指定されたエントリを削除する
 *	i： 削除する要素番号
 */
KNameCard.delEntry = function(i){
	if ((i<0) || (KNameCard.Cards.CardList.length <= i)) {
		return;
	}
	KNameCard.Cards.CardList.splice(i,1);
	return ;
}

/**
 *	削除ボタンがクリックされた時にエントリを削除して再表示するハンドラ
 */
KNameCard.delAndShow = function(event){
	var elm = event.target;
	var pos_flg = elm.parentNode.parentNode.id;
	var id = parseInt(pos_flg.replace("CardNo", ""));

	KNameCard.delEntry(id);
	KNameCard.showNameCardList();
}

/**
 *	名刺一覧を表示する
 */
KNameCard.showNameCardList = function(){
	var mode = KNameCard.DispMode;

	KNameCard.createListTitle(mode);
	KNameCard.createList(mode);

	if (mode == 'Input') {
		KNameCard.appendInputField();
		KNameCard.showConfigArea(false);
	}
	else if (mode == 'View') {
		KNameCard.showConfigArea(true);
	}
	else{
		KNameCard.showConfigArea(false);
	}
}

/******************************************************************************
 *	ソート関連
 *****************************************************************************/

/**
 *	以前のソート順をチェックして今回のソート順を返す
 *	col：ソート項目
 */
KNameCard.getSortOrder = function(col){
	if(col in KNameCard.SortOrder){
		KNameCard.SortOrder[col] *= -1;
	}
	else{
		KNameCard.SortOrder[col] = 1;
	}
	return KNameCard.SortOrder[col];
}

/**
 *	ソートして表示する
 */
KNameCard.clickToSort = function(event){
	var elm = event.target;
	var col = elm.id.replace("Col", "");

	var order = KNameCard.getSortOrder(col);
	var list = KNameCard.Cards.CardList.concat();
	list.sort(function(a, b){
		if(a[col] > b[col]){ return order;}
		else if(a[col] < b[col]){ return (-1 * order)}
		else{return 0;}
	});

	var mode = KNameCard.DispMode;

	KNameCard.createListTitle(mode);
	KNameCard.createList(mode, list);

	return;
}

/******************************************************************************
 *	設定パネル関連
 *****************************************************************************/
/**
 *	名刺に含まれる文字列を全て連結してその中から条件がヒットした場合trueを返す。
 *	ヒットしなかった時はfalseを返す。
 *	検索条件がない（空文字列）の場合はtrueを返す。
 *	name_card：1人分の名刺情報
 *	str：検索文字列
 */
KNameCard.checkFilter = function(name_card, str){
	str = str.trim();
	if (!str) {
		return true;
	}

	var target = "";
	for(var key in name_card){
		var val = name_card[key];
		val = val.trim();
		if (!val) {
			continue;
		}
		target += val;
	}

	if (target.indexOf(str) >= 0) {
		return true;
	}
	else{
		return false;
	}
}


/**
 *	検索結果の配列を返す
 *	filter：検索条件の配列
 */
KNameCard.getTargetNameList = function(filter){
	if (!filter || !filter[0]) {
		return null;
	}

	var list = KNameCard.Cards.CardList.concat();

	for(var i=0; i<filter.length; i++){
		for(var j=list.length-1; j>=0; j--){
			if (KNameCard.checkFilter(list[j], filter[i]) == false) {
				list.splice(j,1);
			}
		}
	}

	return list;
}


/*
 *	絞り込み検索
 */
KNameCard.searchCardList = function(){
	var input = document.getElementById("KeyWords").value.trim();
	var keywords = input.split(/\s+/);

	var list = KNameCard.getTargetNameList(keywords);
	var mode = KNameCard.DispMode;

	KNameCard.createListTitle(mode);
	KNameCard.createList(mode, list);

	return;
}

/**
 *	表示項目設定を表示する
 */
KNameCard.showDisplayColConfig = function(){
	var ShowColsCheckBoxs = document.getElementById("ShowColsCheckBoxs");
	ShowColsCheckBoxs.innerHTML = "";

	for(var i=0; i<KNameCard.EntryList.length; i++){
		var div = document.createElement("div");
		div.setAttribute("class", "CheckBoxDiv");

		var cb = document.createElement("input");
		cb.setAttribute("type", "checkbox");
		cb.setAttribute("name", "DispColConfig");
		cb.value = KNameCard.EntryList[i]["Name"];

		if (KNameCard.Config.DispCols.indexOf(KNameCard.EntryList[i]["Name"]) >= 0) {
			cb.checked = true;
		}

		div.appendChild(cb);
		var txt = document.createTextNode(KNameCard.EntryList[i]["Title"]);
		div.appendChild(txt);

		ShowColsCheckBoxs.appendChild(div);
	}
	return;
}

/**
 *	検索の表示、非表示を切り替える
 */
KNameCard.toggleSearchArea = function(){
	var SearchArea = document.getElementById("SearchArea");
	if (SearchArea.style.display == "none") {
		SearchArea.style.display = "table";
		var Input = document.getElementById("KeyWords");
		var SelStr = String(document.getSelection());
		Input.value = SelStr;
		Input.focus();
	}
	else{
		SearchArea.style.display = "none";
	}
	return;
}

/**
 *	表示項目設定の表示、非表示を切り替える
 */
KNameCard.toggleDisplayColConfig = function(){
	var ConfigShowCols = document.getElementById("ConfigShowCols");
	if (ConfigShowCols.style.display == "none") {
		ConfigShowCols.style.display = "table";
	}
	else{
		ConfigShowCols.style.display = "none";
	}
	return;
}

/**
 *	チェックされた表示項目を取得する
 */
KNameCard.getDisplayColConfigChecked = function(){
	var boxs = document.getElementsByName("DispColConfig");
	var arr = Array();
	for(var i=0; i<boxs.length; i++){
		if (boxs[i].checked) {
			arr.push(boxs[i].value);
		}
	}
	KNameCard.Config.DispCols = arr;
}

/**
 *	設定された表示項目にしたがって再表示する
 */
KNameCard.onDisplayColConfigClicked = function(){
	KNameCard.toggleDisplayColConfig();
	KNameCard.getDisplayColConfigChecked();
	KNameCard.DispMode = "View";
	KNameCard.showNameCardList();
	KNameCard.writeConfigFile();
}

/**
 *	設定エリアの表示、非表示を設定する。
 *	基本的にViewモードの時だけ表示する。
 */
KNameCard.showConfigArea = function(show){
	var div = document.getElementById("ConfigArea");
	if (show) {
		div.style.display = "block";
	}
	else{
		div.style.display = "none";
	}
	return;
}

/*
 *	名刺データを保存する
 */
KNameCard.save = function(){
	var elm = document.activeElement;
	if (elm) {
		elm.blur();
	}
	KNameCard.writeNameCards();
}

/**
 *	名刺データを別名で保存する
 */
KNameCard.saveAs = function(){
	dialog.showSaveDialog(
		browserWindow.getFocusedWindow(),
		{
			title:"名刺データを保存",
			defaultPath:KNameCard.Config.DataPath,
			filters: [{ name: 'NameCard', extensions: ['json'] }],
		},
		function(filename){
			try{
				if (!filename) {
					return;		// ファイル名が取得できないのはキャンセル時
				}
				else{
					KNameCard.writeNameCards(filename);
					if (KNameCard.Config.DataPath == filename) {
						return;
					}
					KNameCard.Config.DataPath = filename;
					KNameCard.writeConfigFile();
				}
			}
			catch(e){
				alert("保存に失敗しました。");
			}
		}
	);
	return ;
}

/**
 *	名刺データを読み込む。
 *	以降のデフォルトデータとする。
 */
KNameCard.open = function(){
	dialog.showOpenDialog(
		browserWindow.getFocusedWindow(),
		{
			title:"名刺データ読み込み",
			defaultPath:KNameCard.Config.DataPath,
			filters: [{ name: 'NameCard', extensions: ['json'] }],
		},
		function(files) {
			try{
				var filename = null;
				if (!files) {
					return;		// ファイル名が取得できないのはキャンンセル時
				}
				else{
					filename = files[0];
				}

				var list = fs.readFileSync(filename, 'utf-8');
				var data = JSON.parse(list);

				if(KNameCard.checkNameCardFormat(data)){
					KNameCard.Cards = data;
					KNameCard.showNameCardList();
					KNameCard.Config.DataPath = filename;
					KNameCard.writeConfigFile();
				}
				else{
					alert("名刺データではありません。");
				}
			}
			catch(e){
				alert("ファイル読み込みに失敗しました。");
			}
		}
	);
	return ;
}

/**
 *	ウィンドウサイズを設定ファイルに書き込む
 */
KNameCard.saveWindowSize = function(){
    if (KNameCard.ResizeTimer !== false) {
        clearTimeout(KNameCard.ResizeTimer);
    }
    KNameCard.ResizeTimer = setTimeout(function() {
        KNameCard.Config.WindowWidth = window.innerWidth;
		KNameCard.Config.WindowHeight = window.innerHeight;
		KNameCard.writeConfigFile();
    }, 1000);
}

/******************************************************************************
 *	コピー、ペースト
 *****************************************************************************/

/**
 *	コピー
 */
KNameCard.copy = function(){
	var SelStr = String(document.getSelection());
	if (!SelStr) {
		return;
	}
	clipboard.writeText(SelStr);
}

/**
 *	ペースト
 */
KNameCard.paste = function(){
	var elm = document.activeElement;
	if (elm.tagName != "INPUT") {
		return;
	}

	if (elm.type.toUpperCase() != "TEXT") {
		return;
	}

	elm.value = clipboard.readText();
}

/******************************************************************************
 *	地図関連
 *****************************************************************************/

/**
 *	Google Mapを描画する
 *	addr：住所文字列
 */
KNameCard.drawMap = function(addr){
	var MapArea = document.getElementById("MapArea");

	var geocoder = new google.maps.Geocoder();
	var lat = 0;
	var lng = 0;
	geocoder.geocode({'address': addr, 'language': 'ja'}, function(results, status) {
		if(status != google.maps.GeocoderStatus.OK){
			return;
		}
		lat = results[0].geometry.location.lat();
		lng = results[0].geometry.location.lng();

		// 中心の位置座標を指定する
		var Center = new google.maps.LatLng( lat , lng );

		// 地図のオプションを設定する
		var mapOptions = {
			zoom: 16 ,				// ズーム値
			center: Center ,		// 中心座標 [latlng]
		};

		// [canvas]に、[mapOptions]の内容の、地図のインスタンス([map])を作成する
		var map = new google.maps.Map( MapArea , mapOptions ) ;

		// マーカーを表示する
		var mopts = {
			position: Center,
			map: map,
		};

		new google.maps.Marker(mopts);
	});
}

/**
 *	地図表示領域の調整と表示
 */
KNameCard.displayMapArea = function(){
	var w = 0.6 * window.innerWidth;
	var h = 0.6 * window.innerHeight;

	var map_area = document.getElementById("MapArea");
	map_area.style.width = w + "px";
	map_area.style.height = h + "px";

	var map_wrapper = document.getElementById("MapWrapper");
	map_wrapper.style.display = "block";
}

/**
 *	地図ボタンクリック時
 */
KNameCard.clickMapButton = function(event){
	var btn = event.target;
	if (!btn.value) {
		return;
	}

	KNameCard.displayMapArea();
	KNameCard.drawMap(btn.value);
}

/**
 *	地図を非表示にする
 */
KNameCard.closeMap = function(){
	var map_wrapper = document.getElementById("MapWrapper");
	map_wrapper.style.display = "none";
}
