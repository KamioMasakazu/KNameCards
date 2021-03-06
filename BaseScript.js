'use strict'

/**
 *	名刺管理ソフト本体のスクリプト。
 *	@author kamio.masakazu@gmail.com(Masakazu Kamio)
 *	@namespace
 */
var KNameCard = KNameCard || {
	/**
	 *	表示モードの指定。View:表示モード、Input:入力モード
	 *	@type {string}
	 */
	DispMode: "View",

	/**
	 *	ウィンドウサイズ変更処理のためのタイマ
	 *	@provate
	 */
	ResizeTimer: false,

	/**
	 *	設定ファイルオブジェクト保持変数
	 *	@private
	 */
	Config: null,

	/**
	 *	名刺データオブジェクト
	 *	@private
	 */
	Cards: null,

	/**
	 *	重複チェック用オブジェクト
	 *	@private
	 */
	ExistVals: {},

	/**
	 *	名刺項目と表示の割り当て定義
	 *	@private
	 *	@const
	 */
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

	/**
	 *	ソート順の記憶領域
	 *	@private
	 */
	SortOrder:{},
};

/** @const */
var electron = require('electron');

/** @const */
const app = electron.remote.app;

/** @const */
var fs = electron.remote.require('fs');

/** @const */
const browserWindow = electron.remote.BrowserWindow;

/** @const */
var dialog = electron.remote.dialog;

/** @const */
var clipboard = electron.remote.clipboard;

/******************************************************************************
 *	ユーティリティ
 *****************************************************************************/

/**
 *	名刺情報の文字列を連結する。この時、空文字列は無視する。
 *	@param {object} name_card	名刺情報
 *	@return {string} name_cardの値を全て連結した文字列
 */
KNameCard.joinCardValue = function(name_card){
	if(!name_card){
		return "";
	}

	let target = "";
	for(let key in name_card){
		let val = name_card[key];
		val = val.trim();
		if (!val) {
			continue;
		}
		target += val;
	}

	return target;
}

/******************************************************************************
 *	内部処理
 *****************************************************************************/
/**
 *	設定ファイルを読み込む
 */
KNameCard.readConfigFile = function(){
	let config_str = fs.readFileSync(app.getPath('userData') + '/config.json', 'utf-8');
	KNameCard.Config = JSON.parse(config_str);
	//console.log(KNameCard.Config);

	return ;
}

/**
 *	設定ファイルを保存する
 */
KNameCard.writeConfigFile = function(){
	let data = JSON.stringify(KNameCard.Config, null, '\t');
	fs.writeFileSync(app.getPath('userData') + '/config.json', data, null);
}

/**
 *	名刺データJSONの形式が正しいかをチェックする
 *	@private
 *	@return {boolean} true:正しい。false:違う。
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
 *	@private
 *	@param {object} data 名刺データ（KNamaeCard.jsonのオブジェクト）
 */
KNameCard.checkNameCard = function(data){
	let DefaultCards = {
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
 *	重複重複チェック用連想配列にチェック文字列を追加する。
 *	@param {name_card}	名刺情報オブジェクト
 *	@private
 */
KNameCard.addExistVal = function(name_card){
	let key = KNameCard.joinCardValue(name_card);
	if(!key){
		return;
	}

	KNameCard.ExistVals[key] = null;
	return ;
}

/**
 *	重複チェック用連想配列を新規に作成する。
 *	@param {Array}	名刺情報の配列
 *	@private
 */
KNameCard.createExistVal = function(card_list){
	KNameCard.ExistVals = {};
	for(let i=0; i<card_list.length; i++){
		KNameCard.addExistVal(card_list[i]);
	}
}

/**
 *	既存の名刺一覧を読み込む
 *	@param {string} file ファイルパス
 *	@param {boolean}	not_set	KNameCard.Cardsに設定しない場合はtrue。
 *	@return {object}	読み込んだ名刺情報（JSON）をオブジェクトにしたもの
 */
KNameCard.readNameCards = function(file, not_set){
	if (!KNameCard.Config.DataPath) {
		KNameCard.Config.DataPath = app.getPath('userData') + "NameCards.json";
	}
	if (!file) {
			file = KNameCard.Config.DataPath;
	}

	let data;
	try{
		let list = fs.readFileSync(file, 'utf-8');
		data = JSON.parse(list);
	}
	catch(e){
		data = null;
	}

	let ret = KNameCard.checkNameCard(data);
	if(!not_set){
		KNameCard.createExistVal(ret.CardList);
		KNameCard.Cards = ret;
	}

	return ret;
}

/**
 *	名刺データを保存する
 *	@param {string} file ファイルパス
 */
KNameCard.writeNameCards = function(file){
	if (!file) {
		file = KNameCard.Config.DataPath;
	}

	let data = JSON.stringify(KNameCard.Cards, null, '\t');
	fs.writeFileSync(file, data, null, function (err) {
		console.log(err);
	});
}

/******************************************************************************
 *	名刺データ表示
 *****************************************************************************/

/**
 *	入力モードの場合に削除ボタンを追加する処理
 *	@private
 *	@param {element:tr}	tr ボタンを追加する&lt;tr&gt;タグのエレメント
 */
KNameCard.addDelButtonToRow = function(tr){
	// 削除ボタン
	let del_td = document.createElement("td");
	let del_btn = document.createElement("button");

	del_btn.innerHTML = "×";
	del_btn.onclick = KNameCard.delAndShow;

	del_td.appendChild(del_btn);
	tr.appendChild(del_td);

	return;
}

/**
 *	表のヘッダを作成する
 *	@private
 *	@param {string} mode Input（入力モード）、View（表示モード）
 */
KNameCard.createListTitle = function(mode){
	let title = document.getElementById('NameCardHeader');

	for(let i=title.childNodes.length-1; i>=0; i--){
		title.removeChild(title.childNodes[i]);
	}
	let tr = document.createElement("tr");

	// 削除欄を追加
	if (mode == 'Input') {
		let del_td = document.createElement("th");
		tr.appendChild(del_td);
	}

	for(let i=0; i<KNameCard.EntryList.length; i++){
		let col = KNameCard.EntryList[i].Name;	// 設定項目

		// 表示モードの時は表示対象項目だけを表示する
		if ((mode == 'View') && (KNameCard.Config.DispCols.indexOf(col) < 0)) {
			continue;
		}

		let th = document.createElement("th");
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
 *	表示モードで&lt;tr&gt;要素を作成して返す。
 *	@private
 *	@param {int}	id 名刺リストの何番目の要素か
 *	@param {string}	value 名刺項目の入力値
 *	@return {element:tr}	作成した&lt;tr&gt;要素
 */
KNameCard.createCardEntryView = function(id, value){
	let tr = document.createElement("tr");
	tr.setAttribute("id", "CardNo"+id);

	// 項目
	for(let i=0; i<KNameCard.EntryList.length; i++){
		let col = KNameCard.EntryList[i].Name;	// 設定項目

		// 表示対象項目だけを表示する
		if (KNameCard.Config.DispCols.indexOf(col) < 0) {
			continue;
		}

		let td = document.createElement("td");
		td.setAttribute("Class", col);

		let val = value[col];
		let txt = document.createTextNode(val);

		if((col == "EMail") && (val)){
			let mailto = document.createElement("a");
			mailto.setAttribute("href", "mailto:" + val);
			mailto.appendChild(txt);
			td.appendChild(mailto);
		}
		else{
			td.appendChild(txt);
		}

		// 地図用ボタン
		if ((col == "Address1") && (val)) {
			let btn = document.createElement("button");
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
 *	入力用に&lt;tr&gt;要素を作成して返す。
 *	@param {int}	id 名刺リストの何番目の要素か
 *	@param {string}	value 名刺項目の入力値
 *	@return {element:tr}	作成した&lt;tr&gt;要素
 */
KNameCard.createCardEntryInput = function(id, value){
	let tr = document.createElement("tr");
	tr.setAttribute("id", "CardNo"+id);

	// 削除ボタン追加
	KNameCard.addDelButtonToRow(tr);

	// 項目
	for(let i=0; i<KNameCard.EntryList.length; i++){
		let col = KNameCard.EntryList[i].Name;	// 設定項目

		let td = document.createElement("td");
		td.setAttribute("Class", col);
		let input = document.createElement("input");
		input.setAttribute("type", "text");
		input.setAttribute("class", "ListInput " + col);

		let val = value[col];
		let txt = document.createTextNode(val);
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
 *	@private
 *	@param {string} mode="View"	Input（入力用）、View（表示用）
 *	@param {object}	data=KNameCard.Cards.CardList 表示するデータのリスト（未指定時は全部のリスト）
 */
KNameCard.createList = function(mode, data){
	if (!data) {
		data = KNameCard.Cards.CardList;
	}

	let list = document.getElementById('NameCardBody');

	for(let i=list.childNodes.length-1; i>=0; i--){
		list.removeChild(list.childNodes[i]);
	}

	for(let i=0; i<data.length; i++){
		let tr;
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
 *	@private
 */
KNameCard.appendInputField = function(){
	let id = KNameCard.Cards.CardList.length;

	let list = document.getElementById('NameCardBody');
	let tr = document.createElement("tr");
	tr.setAttribute("id", "CardNo"+id);

	// 削除ボタン追加
	KNameCard.addDelButtonToRow(tr);

	for(let i=0; i<KNameCard.EntryList.length; i++){
		let col = KNameCard.EntryList[i].Name;	// 設定項目

		let td = document.createElement("td");
		td.setAttribute("Class", col);
		let input = document.createElement("input");
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
 *	@param {event}	イベント発火時のオブジェクト
 */
KNameCard.changeInput = function(event){
	let elm = event.target;
	let val = elm.value.trim();	// 入力された値

	// <tr>のIDから要素番号を作る
	let pos_flg = elm.parentNode.parentNode.id;
	let id = parseInt(pos_flg.replace("CardNo", ""));

	// 新規入力時
	if (id == KNameCard.Cards.CardList.length) {
		KNameCard.addNewEntry();
		KNameCard.appendInputField();
	}

	let key = elm.classList[1];
	KNameCard.Cards.CardList[id][key] = val;

	return;
}

/**
 *	入力モードで新規に空の項目を追加する
 *	@private
 */
KNameCard.addNewEntry = function(){
	let obj = {};
	for(let i=0; i<KNameCard.EntryList.length; i++){
		obj[KNameCard.EntryList[i].Name] = "";
	}

	KNameCard.Cards.CardList.push(obj);
	return;
}

/**
 *	指定されたエントリを削除する
 *	@private
 *	@param {int} i	削除する要素番号
 */
KNameCard.delEntry = function(i){
	if ((i<0) || (KNameCard.Cards.CardList.length <= i)) {
		return;
	}
	let key = KNameCard.joinCardValue(KNameCard.Cards.CardList[i]);
	delete KNameCard.ExistVals[key];
	KNameCard.Cards.CardList.splice(i,1);
	return ;
}

/**
 *	削除ボタンがクリックされた時にエントリを削除して再表示するハンドラ
 *	@param {event}	イベント発火時のオブジェクト
 */
KNameCard.delAndShow = function(event){
	let elm = event.target;
	let pos_flg = elm.parentNode.parentNode.id;
	let id = parseInt(pos_flg.replace("CardNo", ""));

	KNameCard.delEntry(id);
	KNameCard.showNameCardList();
}

/**
 *	名刺一覧を表示する
 */
KNameCard.showNameCardList = function(){
	let mode = KNameCard.DispMode;

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
 *	@private
 *	@param	{string}	col ソート項目(KNameCard.EntryListのTitle参照)
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
 *	@param {event}	イベント発火時のオブジェクト
 */
KNameCard.clickToSort = function(event){
	let elm = event.target;
	let col = elm.id.replace("Col", "");

	let order = KNameCard.getSortOrder(col);
	let list = KNameCard.Cards.CardList.concat();
	list.sort(function(a, b){
		if(a[col] > b[col]){ return order;}
		else if(a[col] < b[col]){ return (-1 * order)}
		else{return 0;}
	});

	let mode = KNameCard.DispMode;

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
 *	@private
 *	@param {object} name_card 1人分の名刺情報
 *	@param {string} str 検索文字列
 *	@return {boolean}	true：ヒットした。false：ヒットしない。
 */
KNameCard.checkFilter = function(name_card, str){
	str = str.trim();
	if (!str) {
		return true;
	}

	let target = KNameCard.joinCardValue(name_card);

	if (target.indexOf(str) >= 0) {
		return true;
	}
	else{
		return false;
	}
}

/**
 *	検索結果の配列を返す
 *	@private
 *	@param {Array<string>}	filter 検索条件の配列
 *	@return {Array<object>}	検索にヒットした名刺情報の配列
 */
KNameCard.getTargetNameList = function(filter){
	if (!filter || !filter[0]) {
		return null;
	}

	let list = KNameCard.Cards.CardList.concat();

	for(let i=0; i<filter.length; i++){
		for(let j=list.length-1; j>=0; j--){
			if (KNameCard.checkFilter(list[j], filter[i]) == false) {
				list.splice(j,1);
			}
		}
	}

	return list;
}


/*
 *	絞り込み検索を行う
 */
KNameCard.searchCardList = function(){
	let input = document.getElementById("KeyWords").value.trim();
	let keywords = input.split(/\s+/);

	let list = KNameCard.getTargetNameList(keywords);
	let mode = KNameCard.DispMode;

	KNameCard.createListTitle(mode);
	KNameCard.createList(mode, list);

	return;
}

/**
 *	表示項目設定を表示する
 */
KNameCard.showDisplayColConfig = function(){
	let ShowColsCheckBoxs = document.getElementById("ShowColsCheckBoxs");
	ShowColsCheckBoxs.innerHTML = "";

	for(let i=0; i<KNameCard.EntryList.length; i++){
		let div = document.createElement("div");
		div.setAttribute("class", "CheckBoxDiv");

		let cb = document.createElement("input");
		cb.setAttribute("type", "checkbox");
		cb.setAttribute("name", "DispColConfig");
		cb.value = KNameCard.EntryList[i]["Name"];

		if (KNameCard.Config.DispCols.indexOf(KNameCard.EntryList[i]["Name"]) >= 0) {
			cb.checked = true;
		}

		div.appendChild(cb);
		let txt = document.createTextNode(KNameCard.EntryList[i]["Title"]);
		div.appendChild(txt);

		ShowColsCheckBoxs.appendChild(div);
	}
	return;
}

/**
 *	検索の表示、非表示を切り替える
 */
KNameCard.toggleSearchArea = function(){
	let SearchArea = document.getElementById("SearchArea");
	if (SearchArea.style.display == "none") {
		SearchArea.style.display = "table";
		let Input = document.getElementById("KeyWords");
		let SelStr = String(document.getSelection());
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
	let ConfigShowCols = document.getElementById("ConfigShowCols");
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
 *	@private
 */
KNameCard.getDisplayColConfigChecked = function(){
	let boxs = document.getElementsByName("DispColConfig");
	let arr = Array();
	for(let i=0; i<boxs.length; i++){
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
 *	@private
 *	@param {boolean}	show true：表示する。false：表示しない
 */
KNameCard.showConfigArea = function(show){
	let div = document.getElementById("ConfigArea");
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
	let elm = document.activeElement;
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
				let filename = null;
				if (!files) {
					return;		// ファイル名が取得できないのはキャンンセル時
				}
				else{
					filename = files[0];
				}

				KNameCard.readNameCards(filename);
				KNameCard.showNameCardList();
				KNameCard.Config.DataPath = filename;
				KNameCard.writeConfigFile();
			}
			catch(e){
				alert("ファイル読み込みに失敗しました。");
			}
		}
	);
	return ;
}

/**
 *	名刺データを読み込んで既存データに追加する。
 */
KNameCard.openAdd = function(){
	dialog.showOpenDialog(
		browserWindow.getFocusedWindow(),
		{
			title:"名刺データ追加読み込み",
			defaultPath:KNameCard.Config.DataPath,
			filters: [{ name: 'NameCard', extensions: ['json'] }],
		},
		function(files) {
			try{
				let filename = null;
				if (!files) {
					return;		// ファイル名が取得できないのはキャンンセル時
				}
				else{
					filename = files[0];
				}

				let append_list = KNameCard.readNameCards(filename, true);

				// 全く同じデータは追加しない
				for(let i=0; i<append_list.CardList.length; i++){
					let key = KNameCard.joinCardValue(append_list.CardList[i]);
					if(key in KNameCard.ExistVals){
						continue;
					}
					else{
						KNameCard.addExistVal(key);
						KNameCard.Cards.CardList.push(append_list.CardList[i]);
					}
				}

				KNameCard.showNameCardList();
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
	let SelStr = String(document.getSelection());
	if (!SelStr) {
		return;
	}
	clipboard.writeText(SelStr);
}

/**
 *	ペースト
 */
KNameCard.paste = function(){
	let elm = document.activeElement;
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
 *	@private
 *	@param {string}	addr 住所文字列
 */
KNameCard.drawMap = function(addr){
	/*	global google	*/
	let geocoder = new google.maps.Geocoder();
	geocoder.geocode({'address': addr, 'language': 'ja'}, function(results, status) {
		if(status != google.maps.GeocoderStatus.OK){
			return;
		}
		let MapArea = document.getElementById("MapArea");

		let lat = results[0].geometry.location.lat();
		let lng = results[0].geometry.location.lng();

		// 中心の位置座標を指定する
		let Center = new google.maps.LatLng( lat , lng );

		// 地図のオプションを設定する
		let mapOptions = {
			zoom: 16 ,				// ズーム値
			center: Center ,		// 中心座標 [latlng]
		};

		// [canvas]に、[mapOptions]の内容の、地図のインスタンス([map])を作成する
		let map = new google.maps.Map( MapArea , mapOptions ) ;

		// マーカーを表示する
		let mopts = {
			position: Center,
			map: map,
		};

		new google.maps.Marker(mopts);
	});
}

/**
 *	地図表示領域の調整と表示
 *	@private
 */
KNameCard.displayMapArea = function(){
	let w = 0.6 * window.innerWidth;
	let h = 0.6 * window.innerHeight;

	let map_area = document.getElementById("MapArea");
	map_area.style.width = w + "px";
	map_area.style.height = h + "px";

	let map_wrapper = document.getElementById("MapWrapper");
	map_wrapper.style.display = "block";
}

/**
 *	地図ボタンクリック時
 *	@param {event}	event イベント発火時のオブジェクト
 */
KNameCard.clickMapButton = function(event){
	let btn = event.target;
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
	let map_wrapper = document.getElementById("MapWrapper");
	map_wrapper.style.display = "none";
}
