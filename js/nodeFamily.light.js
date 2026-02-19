'use strict'
/**
 * nodeFamily.light v1.9.0 | (c) 2026 Michał Amerek, nodeFamily
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this file and associated files (the "Software"), unless otherwise specified,
 * to deal in the Software only for personal and archiving purposes, as a part
 * of a family tree visualized by or downloaded from the Internet.
 *
 * The Software may not be distributed or copied for any other purpose. You are
 * not permitted to modify, merge, publish, sublicense, rent, sell, lease,
 * loan, decompile, reverse engineer or create derivative works from this Software.
 *
 * The above copyright and license notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
const NF_TYPE = "nfType";
const NF_RECORD = "nfRecord";
const NF_VALUE = "nfValue";
const NF_KEYS = [NF_TYPE, NF_RECORD, NF_VALUE];
const Gedcom = function(gedcomData) {
    const _contents = gedcomData;
    const lines = _contents.replace(/[\r\n]+/g,'\n').split('\n')
    let _tags = [];
    for (let i = 0; i < lines.length; i++) {
        _tags.push(new Gedcom.Tag(lines[i], lines[i+1]));
    }

    this.toJson = function() {
        const context = {};
        let record = Gedcom.Tag.Record.create(_tags[0], undefined, context);
        for (let tagIndex = 1; tagIndex < _tags.length; tagIndex++) {
            record = Gedcom.buildTree(record, _tags, tagIndex, context);
        }
        return context;
    }

}

Gedcom.download = function(contents, ext) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(contents));
  let extension = ext || ".ged"
  element.setAttribute('download', document.exportForm.elements['FILE.nfValue'].value.replace(/\s/g, '-') + extension);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

Gedcom.buildFromJson = function(json, ext) {
    let contents = "";
    for (const [key, value] of Object.entries(json)) {
        if (NF_KEYS.includes(key)) {
            continue;
        }
        if (value[NF_RECORD]) {
            let record = value[NF_RECORD];
            if (ext == ".tsv") {
                record = record.replace(" ", "\t").replace(" ", "\t");
            }
            contents += record + "\r\n";
        }
        contents += Gedcom.buildFromJson(value, ext);
    }
    return contents;
}

Gedcom.fromJson = function(json, ext) {
    let contents = Gedcom.buildFromJson(json, ext);
    contents += "0 TRLR";
    return contents;
}

Gedcom.buildTree = function(parentRecord, tags, tagIndex, context) {
    tagIndex = tagIndex++;
    const tag = tags[tagIndex];
    const currentLevel = tag.getLevel();
    if (typeof parentRecord === 'undefined') {
        return parentRecord;
    }
    const parentLevel = parentRecord.getLevel();
    let record = parentRecord;
    if (currentLevel < parentLevel) {
        const parent = Gedcom.Tag.Record.findParent(parentRecord, parentLevel - currentLevel);
        record = Gedcom.Tag.Record.create(tag, parent, context);
    } else if (currentLevel > parentLevel) {
        record = Gedcom.Tag.Record.create(tag, parentRecord, context);
    } else {
        record = Gedcom.Tag.Record.create(tag, parentRecord.getParentRecord(), context);
    }
    return record;
}

Gedcom.Tag = function(line, nextLine) {

    const tagValues = line.split(/\s+/g);
    const _level = parseInt(tagValues[0]);
    const _tag = tagValues[1];
    const _value = tagValues.slice(2, tagValues.length).join(" ");

    const _IDENTIFIERS = ["FAM","INDI","OBJE","REPO","SOUR","SUBM","SUBN"]; // "NOTE" ?
    const _OBJECT_TAGS = ["ADDR","BIRT","BURI","DEAT","MARR","NAME","NOTE","SOUR", "FAMC", "CHIL", "FAMS"];
    const _COLLECTION_TAGS = ["CONT", "CONC"]; // SUBM, EVEN ?
    const _AT = "@";

    this.isHead = function() {
        return _level === 0 && _tag === "HEAD";
    }

    this.getTag = function() {
        return _tag;
    }

    this.getValue = function() {
        return _value;
    }

    this.getLevel = function() {
        return _level;
    }

    this.isIdentifier = function() {
        return _IDENTIFIERS.includes(_value);
    }

    this.isObject = function() {
        return _OBJECT_TAGS.includes(_tag) || (parseInt(this.getLevel()) < parseInt(new Gedcom.Tag(nextLine).getLevel()));
    }

    this.isCollection = function() {
        return _COLLECTION_TAGS.includes(_tag);
    }

    this.isPlain = function() {
        return !this.isObject() && !this.isCollection();
    }
}

Gedcom.Tag.Record = function(tag, parentRecord, context) {

    const _level = tag.getLevel();
    const _parentRecord = parentRecord;
    const _localContext = context;

    this.getLevel = function() {
        return _level;
    }

    this.getParentRecord = function() {
        return _parentRecord;
    }

    this.getLocalContext = function() {
        return _localContext;
    }
}


Gedcom.Tag.Record.create = function(tag, parentRecord, context) {
    if (tag.isHead()) {
        return Gedcom.Tag.Record.head(tag, parentRecord, context);
    }
    if (tag.isIdentifier()) {
        return Gedcom.Tag.Record.identifier(tag, parentRecord, context);
    }
    if (tag.getLevel() > 0) {
        if (tag.isObject()) {
            return Gedcom.Tag.Record.object(tag, parentRecord, context);
        }
        if (tag.isCollection()) {
            return Gedcom.Tag.Record.collection(tag, parentRecord, context);
        }
        if (tag.isPlain()) {
            return Gedcom.Tag.Record.plain(tag, parentRecord, context);
        }
    }
}

Gedcom.Tag.Record.findParent = function(child, levelUp) {
    if (levelUp == 0) {
        return child.getParentRecord();
    }
    return Gedcom.Tag.Record.findParent(child.getParentRecord(), levelUp - 1);
}

Gedcom.Tag.Record.head = function(tag, parentRecord, context) {
    const c = context['HEAD'] = {}
    c[NF_TYPE] = "HEAD";
    c[NF_RECORD] = tag.getLevel() + " " + tag.getTag();
    return new Gedcom.Tag.Record(tag, parentRecord, c);
}

Gedcom.Tag.Record.identifier = function(tag, parentRecord, context) {
    const id = tag.getTag().replace(/@/g, "");
    const c = context[id] = {};
    c[NF_TYPE] = tag.getValue();
    c[NF_RECORD] = tag.getLevel() + " " + tag.getTag() + " " + tag.getValue();
    return new Gedcom.Tag.Record(tag, parentRecord, c);
}

Gedcom.Tag.Record.object = function(tag, parentRecord, context) {
    const c = {};
    c[NF_VALUE] = tag.getValue();
    if (tag.getTag() == "FAMC" || tag.getTag() == "CHIL" || tag.getTag() == "FAMS") {
        c[NF_VALUE] = c[NF_VALUE].replace(/@/g, "");
    }
    c[NF_RECORD] = tag.getLevel() + " " + tag.getTag();
    if (tag.getValue().trim() != "") {
        c[NF_RECORD] += " " + tag.getValue();
    }
    const parentContext = parentRecord.getLocalContext();
    if (parentContext) {
        if (parentContext[tag.getTag()] && tag.getTag() != "NAME") {
            const previous = parentContext[tag.getTag()];
            if (!Array.isArray(previous)) {
                parentContext[tag.getTag()] = [];
                parentContext[tag.getTag()].push(previous);
            }
            parentContext[tag.getTag()].push(c);
        } else if (tag.getTag() == "CHIL" || tag.getTag() == "FAMS") {
            parentContext[tag.getTag()] = parentContext[tag.getTag()] || [];
            parentContext[tag.getTag()].push(c);
        } else {
            parentContext[tag.getTag()] = c;
        }
    }
    return new Gedcom.Tag.Record(tag, parentRecord, c);
}

Gedcom.Tag.Record.collection = function(tag, parentRecord, context) {
    const parentContext = parentRecord.getLocalContext();
    let value = tag.getValue();
    if (tag.getTag() !== "CONT") {
        value = value.replace(/@/g, "");
    }
    parentContext[tag.getTag()] = parentContext[tag.getTag()] || [];
    const obj = {};
    obj[NF_VALUE] = value;
    obj[NF_RECORD] = tag.getLevel() + " " + tag.getTag() + " " + tag.getValue();
    parentContext[tag.getTag()].push(obj);
    return new Gedcom.Tag.Record(tag, parentRecord, {});
}

Gedcom.Tag.Record.plain = function(tag, parentRecord, context) {
    const c = {};
    let value = tag.getValue();
    if (tag.getTag() === "HUSB" || tag.getTag() === "WIFE") {
        value = value.replace(/@/g, "");
    }
    const parentContext = parentRecord.getLocalContext();
    c[NF_VALUE] = value;
    c[NF_RECORD] = tag.getLevel() + " " + tag.getTag();
    if (value.trim() != "") {
        c[NF_RECORD] += " " + tag.getValue();
    }
    parentContext[tag.getTag()] = c;
    return new Gedcom.Tag.Record(tag, parentRecord, {});
}

const NodeFamily = function(jsonFromGedcom, d3, dagreD3, dagreD3GraphConfig) {

    let _subTree = new NodeFamily.Tree();
    let _maxFamilyId = 0;
    let _maxPersonId = 0;
    const _familyData = jsonFromGedcom;
    const _families = Object.fromEntries(Object.entries(_familyData).filter(function([key, value]) {
        if (value[NF_TYPE] == 'FAM') {
            let famId = parseInt(key.substring(1, key.length));
            if (!isNaN(famId)) {
                if (famId > _maxFamilyId) {
                    _maxFamilyId = famId;
                }
            }
        }
    }));
    const _persons = Object.fromEntries(Object.entries(_familyData).filter(function([key, value]) {
        if (value[NF_TYPE] == 'INDI') {
            let id = parseInt(key.substring(1, key.length));
            if (!isNaN(id)) {
                if (id > _maxPersonId) {
                    _maxPersonId = id;
                }
            }
            return [key, value];
        }
    }));
    const _sortedPersons = Object.entries(_persons).sort((a, b) => (a[1].NAME[NF_VALUE].replace(/\//g, " ") > b[1].NAME[NF_VALUE].replace(/\//g, " ")) ? 1 : -1);
    const _personsToIndex = [];
    for (let [key, value] of Object.entries(_sortedPersons)) {
        let nick = "";
        let givn = "";
        let surname = "";
        let birtDate = "";
        let birtPlace = "";
        let deathDate = "";
        let deathPlace = "";
        let burialPlace = "";
        let title = "";
        let occupation = "";
        if (value[1].NAME.NICK) {
            nick = value[1].NAME.NICK[NF_VALUE];
        }
        if (value[1].NAME.SURN) {
            surname = value[1].NAME.SURN[NF_VALUE];
        }
        if (value[1].NAME.GIVN) {
            givn = value[1].NAME.GIVN[NF_VALUE];
        }
        if (value[1].BIRT && value[1].BIRT.DATE) {
            birtDate = value[1].BIRT.DATE[NF_VALUE];
        }
        if (value[1].BIRT && value[1].BIRT.PLAC) {
            birtPlace = value[1].BIRT.PLAC[NF_VALUE];
        }
        if (value[1].DEAT && value[1].DEAT.DATE) {
            deathDate = value[1].DEAT.DATE[NF_VALUE];
        }
        if (value[1].DEAT && value[1].DEAT.PLAC) {
            deathPlace = value[1].DEAT.PLAC[NF_VALUE];
        }
        if (value[1].BURI && value[1].BURI.PLAC) {
            burialPlace = value[1].BURI.PLAC[NF_VALUE];
        }
        if (value[1].TITL && value[1].TITL[NF_VALUE]) {
            title = value[1].TITL[NF_VALUE];
        }
        if (value[1].OCCU && value[1].OCCU[NF_VALUE]) {
            occupation = value[1].OCCU[NF_VALUE];
        }
        _personsToIndex.push({
            "id": value[0],
            "name": value[1].NAME[NF_VALUE].replace(/\//g, "").trim(),
            "surname": surname,
            "nick": nick.replace(/"/g, ''),
            "birtDate": birtDate,
            "birtPlace": birtPlace.replace(/[.,]/g, ""),
            "deathDate": deathDate,
            "deathPlace": deathPlace.replace(/[.,]/g, ""),
            "burialPlace": burialPlace.replace(/[.,]/g, ""),
            "title": title.replace(/[.,]/g, ""),
            "occupation": occupation.replace(/[.,]/g, ""),
            "givn": givn.replace(/[.,]/g, "")
        });
    }

    let _lunrIndex = null;
    const regenerateIndex = function(documents) {
    	_lunrIndex = lunr(function() {
            this.ref('id')
            this.field('name')
            this.field('surname')
            this.field('nick')
            this.field('birtDate')
            this.field('birtPlace')
            this.field('deathDate')
            this.field('deathPlace')
            this.field('burialPlace')
            this.field('title')
            this.field('occupation')
            this.field('givn')
            this.pipeline.remove(lunr.trimmer)
            _personsToIndex.forEach(function (person) {
                this.add(person)
            }, this)
        })
    };
    regenerateIndex(_personsToIndex);
    const _d3 = d3;
    const _graphlib = new dagreD3.graphlib.Graph();
    const _Renderer = new dagreD3.render();
    const _svg = d3.select("svg");
    const _inner = _svg.append("g");
    const _zoom = d3.zoom()
        .on("zoom", function() {
          _inner.attr("transform", d3.event.transform);
        });
    let _startPersonId;
    let _startFamilyId;
    let _config = { numberOfParentGens: 1, numberOfChildGens: 1, numberOfOtherGens: 1 };
    let _personForm;
    let _exportForm;
    let _familyForm;
    let _personList;
    let _sourceDialog;

    this.getName = function(id) {
        if (_familyData[id] && _familyData[id].NAME) {
            return _familyData[id].NAME[NF_VALUE].replace(/\//g, " ");
        }
        return "";
    }

    this.getSurname = function(id) {
        if (_familyData[id] && _familyData[id].NAME.SURN) {
            return _familyData[id].NAME.GIVN[NF_VALUE].split(" ")[0] + " " + _familyData[id].NAME.SURN[NF_VALUE];
        }
        else return this.getName(id);
    }

    this.getSourceTitle = function(id) {
        if (_familyData[id]) {
            if (_familyData[id].TITL) {
                return _familyData[id].TITL[NF_VALUE];
            }
            if (_familyData[id].OBJE && _familyData[id].OBJE.TITL) {
                return _familyData[id].OBJE.TITL[NF_VALUE];
            }
        }
        return "";
    }

    const generateNextFamilyId = function() {
        _maxFamilyId = _maxFamilyId + 1;
        return "F" + _maxFamilyId;
    }

    const generateNextPersonId = function() {
        _maxPersonId = _maxPersonId + 1;
        return "I" + _maxPersonId;
    }

    this.getFamilyNames = function(id) {
        let names = "";
        if (typeof _familyData[id] === 'undefined') {
            return names;
        }
        const wifeId = _familyData[id].WIFE;
        const husbandId = _familyData[id].HUSB;
        if (wifeId && _familyData[wifeId[NF_VALUE]].NAME) {
            if (_familyData[wifeId[NF_VALUE]].NAME.GIVN && _familyData[wifeId[NF_VALUE]].NAME.SURN) {
                names += _familyData[wifeId[NF_VALUE]].NAME.GIVN[NF_VALUE].split(" ")[0];
            } else {
                names += _familyData[wifeId[NF_VALUE]].NAME[NF_VALUE].replace(/\//g, " ");
            }
        }
        if (wifeId && husbandId) {
            names += " & ";
        }
        if (husbandId && _familyData[husbandId[NF_VALUE]].NAME) {
            names += _familyData[husbandId[NF_VALUE]].NAME[NF_VALUE].replace(/\//g, " ");
        }
        return names;
    }

    this.subscribeSourceDialog = function(sourceDialog) {
        _sourceDialog = sourceDialog;
    }

    this.subscribePersonForm = function(personForm) {
       _personForm = personForm;
    }

    this.subscribeExportForm = function(exportForm) {
       _exportForm = exportForm;
    }

    this.subscribeFamilyForm = function(familyForm) {
       _familyForm = familyForm;
    }

    this.subscribePersonList = function(personList) {
        _personList = personList;
        _personList.setData(_lunrIndex, _familyData);
        _personList.fill(0);
    }

    this.openSource = function(event) {
      const id = event.target.getAttribute("data-id");
      if (id && _familyData[id]) {
        _sourceDialog.open(_familyData[id]);
      }
    }

    this.openDataCard = function() {
        if (!_personForm.isActive() && !_familyForm.isActive()) {
            _exportForm.hide();
            _familyForm.hide();
            _personList.hide();
            if (_startFamilyId) {
                _familyForm.show();
            } else {
                _personForm.show();
            }
        }
    }

    this.togglePersonForm = function() {
        if (_familyForm.isActive()) {
            _familyForm.hide();
            _exportForm.hide();
            _personList.hide();
            _personForm.show();
        }
    }

    this.toggleFamilyForm = function() {
        if (_personForm.isActive()) {
            _personForm.hide();
            _exportForm.hide();
            _personList.hide();
            _familyForm.show();
        }
    }

    this.toggleExportForm = function() {
        _personForm.hide();
        _familyForm.hide();
        _personList.hide();
        _exportForm.show();
    }

    this.togglePersonList = function() {
        _exportForm.hide();
        _personForm.hide();
        _familyForm.hide();
        _personList.show();
    }

    this.setGraph = function(dagreD3GraphConfig) {
        _graphlib.setGraph(dagreD3GraphConfig);
        _graphlib.graph().transition = function(selection) {
          return selection.transition().duration(500);
        };
    }

    this.setConfig = function(config) {
        _config = config;
    }

    this.visualize = function(startPoint, omitPushState) {
        let start = startPoint;
        if (typeof _startPersonId === 'undefined') {
            for (let key of Object.keys(_familyData)) {
              if (_familyData[key][NF_TYPE] == 'INDI') {
                _startPersonId = key;
                break;
              }
            }
        }
        if (typeof startPoint === 'undefined') {
            start = _startPersonId;
        }
        if (_familyData[start][NF_TYPE] == 'FAM') {
            if (_familyForm) {
                _familyForm.reset();
                this.toggleFamilyForm();
                _familyForm.fill(start, _familyData[start]);
                if (startPoint) {
                    _startFamilyId = startPoint;
                    _startPersonId = null;
                }
                start = _startFamilyId;
            }
        }
        if (_familyData[start][NF_TYPE] == 'INDI') {
            if (_personForm) {
                _personForm.reset();
                this.togglePersonForm();
                _personForm.fill(start, _familyData[start]);
            }
            if (startPoint) {
                _startPersonId = startPoint;
                _startFamilyId = null;
            }
            start = _startPersonId;
        }
        if (!omitPushState) {
            history.pushState({"start": start}, "");
        }
        _d3.select("svg > g > *").remove();
        _svg.call(_zoom.transform, _d3.zoomIdentity.scale(1));
        _subTree.removeNodes(_graphlib);
        let tree = new NodeFamily.Tree();
        tree.pushNode(start);
        NodeFamily.addChildren(_familyData, start, _config, tree);
        NodeFamily.addParentsWithSiblings(_familyData, start, _config, tree);
        tree.setEdges(_graphlib);
        tree.addNodes(_graphlib, _familyData, start);
        _subTree = tree;
        _svg.call(_zoom);
        _Renderer(_inner, _graphlib);
        let widthToReduce = 0;
        const editForm = document.getElementById('editForm');
        if (editForm && editForm.style.display != 'none') {
            widthToReduce = editForm.offsetWidth;
        }
        const svgWidth = document.getElementsByTagName('body')[0].offsetWidth - widthToReduce;
        const headerHeight = document.getElementById("header").offsetHeight;
        const svgHeight = clientHeight - headerHeight;
        let zoomScale = Math.max( Math.min(svgWidth / _graphlib.graph().width, svgHeight / _graphlib.graph().height), 0.5);
        if (Object.entries(_familyData).length < 3) {
            zoomScale = zoomScale * 0.3;
        }
        _svg.call(_zoom.transform, _d3.zoomIdentity.translate((svgWidth/2) - ((_graphlib.graph().width*zoomScale)/2), 0).scale(zoomScale));
        let newHeight = _graphlib.graph().height * zoomScale; // + 40;
        if (newHeight < workspaceHeight) {
            newHeight = workspaceHeight;
        }
        _svg.attr('height', newHeight);
        const nodes = _inner.selectAll("g.node");
        const that = this;
        nodes.on('click', function (nodeId) {
            that.visualize(nodeId);
        });
        if (_exportForm) {
            _exportForm.fill(_familyData.HEAD);
        }
        document.querySelectorAll(".spouse").forEach(element => element.addEventListener('click', this.editNode.bind(this), true));
        document.querySelectorAll(".child").forEach(element => element.addEventListener('click', this.editNode.bind(this), true));
    }

    const fillPersonDropdown = function(event) {
        const select = document.getElementById("datalist");
        const length = select.options.length;
        for (let i = length-1; i >= 0; i--) {
          select.options[i] = null;
        }
        if( event.target.value.length < 3 ) return;
        let result = [];
        NodeFamily.searchPerson(_lunrIndex, _familyData, event.target.value, result);
    }

    const toggleOrientation = function(event) {
        let rankdir = 'TB';
        if (event.target.checked) {
            rankdir = 'RL';
        }
        event.target.parentNode.classList.toggle("active");
        this.setGraph({rankdir: rankdir, edgesep: 10, ranksep: 25, nodesep: 10});
        const start = _startFamilyId ? _startFamilyId : _startPersonId;
        this.visualize(start);
    }

    const changeConfig = function(event) {
        let config = {
            numberOfParentGens: document.getElementById('numberOfParentGens').value,
            numberOfChildGens: document.getElementById('numberOfChildrenGens').value,
            numberOfOtherGens: document.getElementById('numberOfOtherGens').value
        }
        this.setConfig(config);
        const start = _startFamilyId ? _startFamilyId : _startPersonId;
        this.visualize(start, true);
    }

    const formToObj = (obj, arr, val) => {
        const level = arr.length - 1;
        const key = arr[0];

        if (arr.length === 1 && isNaN(key)) {
            if (val.trim() != "") {
                obj[key] = val;
                let recordValues = obj[NF_RECORD].split(/\s+/g);
                obj[NF_RECORD] = recordValues[0] + " " + recordValues[1] + " " + recordValues.slice(2, recordValues.length).join(" ");
            } else {
                obj[key] = null;
                obj[NF_RECORD] = null;
            }
            return;
        }
        if (arr.length === 1 && !isNaN(key)) {
            obj.push(val);
            return;
        }
        const restArr = arr.splice(1);
        if (!obj[key]) {
            let sub = obj[arr[0]] = {};
            if (restArr.length >= 1  && val.trim() != "") {
                const lvl = parseInt(obj["nfRecord"].substr(0, obj["nfRecord"].indexOf(" "))) + 1;
                obj[arr[0]][NF_RECORD] = lvl + " " + arr[0];
            }
            if (restArr.length == 1 && val.trim() != "") {
                obj[arr[0]][NF_RECORD] += " " + val;
            }
            for (let i = 0; i < restArr.length - 1; i++) {
                sub[restArr[i]] = {};
                let lvl = i+2;
                sub[restArr[i]][NF_RECORD] = lvl + " " + restArr[i];
                if (i == restArr.length - 2) {
                    sub[restArr[i]][NF_RECORD] += " " + val;
                }
            }
            obj[key] = sub;

        }
        formToObj(obj[key], restArr, val);
    }

    const sanitizeForm = (obj) => {
        const ignores = [null, undefined],
        isNonEmpty = val => !ignores.includes(val) && (typeof(val) !== "object" || Object.keys(val).length)
        return JSON.parse(JSON.stringify(obj), function(k, v) {
            if (isNonEmpty(v))
                return v;
        });
    };

    const exportTsv = function(event) {
        event.preventDefault();
        let fileName = document.exportForm.elements['FILE.nfValue'];
        if (fileName.value.trim() == ""){
            fileName.setCustomValidity('File name is required');
            return;
        }
        const contents = Gedcom.fromJson(_familyData, ".tsv");
        Gedcom.download(contents, ".tsv");
        return false;
    }

    const exportJson = function(event) {
        event.preventDefault();
        let fileName = document.exportForm.elements['FILE.nfValue'];
        if (fileName.value.trim() == ""){
            fileName.setCustomValidity('File name is required');
            return;
        }
        const contents = JSON.stringify(_familyData, null, 2);
        Gedcom.download(contents, ".json");
        return false;
    }

    const exportGedcom = function(event) {
        event.preventDefault();
        let fileName = document.exportForm.elements['FILE.nfValue'];
        let submitterName = document.exportForm.elements['SUBM.NAME.nfValue'];
        if (submitterName.value.trim() == "") {
            submitterName.setCustomValidity('Submitter name is required');
            return;
        }
        if (fileName.value.trim() == ""){
            fileName.setCustomValidity('File name is required');
            return;
        }
        _familyData.HEAD = {};
        _familyData.HEAD[NF_RECORD] = "0 HEAD";
        _familyData.HEAD.SOUR = {};
        _familyData.HEAD.SOUR[NF_RECORD] = "1 SOUR NODE.FAMILY";
        _familyData.HEAD.SOUR.NAME = {};
        _familyData.HEAD.SOUR.NAME[NF_RECORD] = "2 NAME Node.Family";
        _familyData.HEAD.SOUR.VERS = {};
        _familyData.HEAD.SOUR.VERS[NF_RECORD] = "2 VERS 0.9.3";
        _familyData.HEAD.SOUR.WWW = {};
        _familyData.HEAD.SOUR.WWW[NF_RECORD] = "2 WWW https://node.family";
        _familyData.HEAD.GEDC = {};
        _familyData.HEAD.GEDC[NF_RECORD] = "1 GEDC";
        _familyData.HEAD.GEDC.VERS = {};
        _familyData.HEAD.GEDC.VERS[NF_RECORD] = "2 VERS 5.5.1";
        _familyData.HEAD.GEDC.FORM = {};
        _familyData.HEAD.GEDC.FORM[NF_RECORD] = "2 FORM LINEAGE-LINKED";
        _familyData.HEAD.CHAR = {};
        _familyData.HEAD.CHAR[NF_RECORD] = "1 CHAR UTF-8";
        _familyData.HEAD.DATE = {};
        _familyData.HEAD.DATE[NF_RECORD] = "1 DATE " + new Date().toLocaleString('default', { year: 'numeric', month: 'short', day: 'numeric'});
        _familyData.HEAD.SUBM = {};
        _familyData.HEAD.SUBM[NF_RECORD] = "1 SUBM";
        const submitterId = document.exportForm.elements['SUBM.nfValue'];
        if (submitterId) {
            _familyData.HEAD.SUBM[NF_RECORD] += " " + submitterId.value;
        }
        _familyData.HEAD.SUBM.NAME = {};
        _familyData.HEAD.SUBM.NAME[NF_RECORD] = "2 NAME " + submitterName.value;
        _familyData.HEAD.FILE = {};

        fileName = fileName.value.replace(/\s/g, '-') + "-" + new Date().toLocaleDateString().split("/").reverse().join('-') + ".ged"

        _familyData.HEAD.FILE[NF_RECORD] = "1 FILE " + fileName;
        const contents = Gedcom.fromJson(_familyData);
        Gedcom.download(contents);
        return false;
    }

    const exportSvg = function(event) {
        event.preventDefault();
        document.getElementById("exportForm").classList.toggle("active");

        setTimeout(() => {
            let fileName = document.exportForm.elements['FILE.nfValue'].value;
            if (fileName.trim() == ""){
                fileName = "MySVGFamilyTree";
            }
            let labels = document.querySelectorAll("g > foreignObject");
            for (let i = 0; i < labels.length; i++) {
                let el = labels[i];
                el.style.textAlign = "center";
                el.style.fontFamily = "poppins";
                el.style.fontSize = "14px";
             }

            var markerDefs = document.querySelectorAll('g > path');
            for (let j = 0; j < markerDefs.length; j++) {
                markerDefs[j].setAttribute("style", "fill: transparent; stroke: #aaa");
                let markerEnd = markerDefs[j].getAttribute("marker-end");
                let fragments = markerEnd.split("#");
                markerDefs[j].setAttribute("marker-end", "url(#" + fragments[1]);
            }
            document.querySelector('svg').setAttribute("viewBox","0 0 " + document.querySelector('svg').width.baseVal.value + " " + document.querySelector('svg').height.animVal.value);
            const svgString = new XMLSerializer().serializeToString(document.querySelector('svg'));
            const svgBlob = new Blob([svgString], {type:"image/svg+xml;charset=utf-8"});
            const svgUrl = URL.createObjectURL(svgBlob);
            const downloadLink = document.createElement("a");
            downloadLink.href = svgUrl;
            downloadLink.download = fileName + ".svg";
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            document.getElementById("exportForm").classList.toggle("active");
        }, 1);

    }

    this.fillHead = function() {
        const head = _familyData.HEAD;
        let msg = "";
        if (head.FILE) {
            msg += head.FILE[NF_VALUE] + ":";
        }
        if (head.GEDC) {
            msg += " GEDCOM";
            if (head.GEDC.VERS) {
                msg += " " + head.GEDC.VERS[NF_VALUE];
            }
            if (head.GEDC.FORM) {
                msg += ", " + head.GEDC.FORM[NF_VALUE];
            }
        }
        if (head.SOUR) {
            msg += ", " + head.SOUR[NF_VALUE];
        }
        if (head.SUBM && head.SUBM.NAME) {
            msg += ", " + head.SUBM.NAME[NF_VALUE];
        }
        if (head.LANG) {
            msg += ", " + head.LANG[NF_VALUE];
        }
        if (head.DATE) {
            msg += ", " + head.DATE[NF_VALUE];
        }
        document.querySelector("#head span.data").innerHTML = msg;
        document.querySelector("#head span.fa-times").style.display = "inline";
        document.querySelector("#head span.fa-info-circle").style.display = "inline";
    }

    this.startFrom = function(event) {
        let id = event.target.value;
        if (event.target.tagName.toLowerCase() == "li") {
            id = event.target.getAttribute("data-id");
        }
        if (_familyData[id] == undefined) {
            return;
        }
        if (id == "" || _familyData[id][NF_TYPE] != 'INDI') {
            return;
        }
        if (_familyData[id][NF_TYPE] != 'INDI') {
            return;
        }
        let rankdir = 'TB';
        if (document.getElementById('orientation').checked) {
            rankdir = 'RL';
        }
        this.setGraph({rankdir: rankdir, edgesep: 10, ranksep: 25, nodesep: 10});
        this.visualize(id);
        var select = document.getElementById("datalist");
        var length = select.options.length;
        select.setAttribute("size", 0);
        for (var i = length-1; i >= 0; i--) {
          select.options[i] = null;
        }
        select.classList.remove("active");
    }

    this.startAndShow = function(event) {
        const active = document.querySelector("#personList ul li.active");
        if (active) {
            active.classList.remove("active");
        }
        event.target.classList.add("active");
        this.startFrom(event);
        this.openDataCard();
    }

    this.editNode = function(event) {
        const id = event.target.getAttribute("data-id");
        this.visualize(id);
    }

    const people = document.getElementById('people');
    people.replaceWith(people.cloneNode(true));
    document.getElementById('people').addEventListener('keyup', fillPersonDropdown.bind(this), true);

    document.getElementById('datalist').addEventListener('change', this.startFrom.bind(this), true);

    const orientationButton = document.getElementById('orientation');
    orientationButton.replaceWith(orientationButton.cloneNode(true));
    document.getElementById('orientation').addEventListener('change', toggleOrientation.bind(this), true);

    const numberOfParentGens = document.getElementById('numberOfParentGens');
    numberOfParentGens.replaceWith(numberOfParentGens.cloneNode(true));
    document.getElementById('numberOfParentGens').addEventListener('change', changeConfig.bind(this), true);

    const numberOfChildrenGens = document.getElementById('numberOfChildrenGens');
    numberOfChildrenGens.replaceWith(numberOfChildrenGens.cloneNode(true));
    document.getElementById('numberOfChildrenGens').addEventListener('change', changeConfig.bind(this), true);

    const numberOfOtherGens = document.getElementById('numberOfOtherGens');
    numberOfOtherGens.replaceWith(numberOfOtherGens.cloneNode(true));
    document.getElementById('numberOfOtherGens').addEventListener('change', changeConfig.bind(this), true);

    document.getElementById("familyName").addEventListener('click', this.editNode.bind(this), true);
    document.getElementById("wifeName").addEventListener('click', this.editNode.bind(this), true);
    document.getElementById("husbandName").addEventListener('click', this.editNode.bind(this), true);

    const svgButton = document.getElementById('exportSvg');
    if (svgButton) {
        svgButton.addEventListener('click', exportSvg.bind(this), true);
    }
    const tsvButton = document.getElementById('exportTsv');
    if (tsvButton) {
        tsvButton.addEventListener('click', exportTsv.bind(this), true);
    }
    const jsonButton = document.getElementById('exportJson');
    if (jsonButton) {
        jsonButton.addEventListener('click', exportJson.bind(this), true);
    }


}
NodeFamily.SourceDialog = function(presenter, dialogElement) {
    const _presenter = presenter;
    const _dialogElement = dialogElement;
    const _container = _dialogElement.querySelector("div");
    _presenter.subscribeSourceDialog(this);

    this.reset = function() {
        _container.innerHTML = "";
        _dialogElement.querySelector("h3").innerHTML = "";
        _dialogElement.querySelector("figure img").setAttribute("src", "");
        _dialogElement.querySelector("figcaption").innerHTML = "";
    }
    this.open = function(sourceNode) {
        this.reset();
        let title = sourceNode.TITL[NF_VALUE];
        _dialogElement.querySelector("h3").innerHTML = title;
        if (sourceNode.OBJE && sourceNode.OBJE.FILE) {
            if (sourceNode.OBJE.FILE.FORM && sourceNode.OBJE.FILE.FORM[NF_VALUE] == "ogg") {
                _dialogElement.querySelector("audio").style.display = "block";
                _dialogElement.querySelector("figure").style.display = "none";
                _dialogElement.querySelector("audio source").setAttribute("src", sourceNode.OBJE.FILE[NF_VALUE]);
                _dialogElement.querySelector("audio").load();
            } else {
                _dialogElement.querySelector("audio").style.display = "none";
                _dialogElement.querySelector("figure").style.display = "block";
                _dialogElement.querySelector("figure img").setAttribute("src", sourceNode.OBJE.FILE[NF_VALUE]);
                if (sourceNode.OBJE.TITL) {
                    _dialogElement.querySelector("figcaption").innerHTML = sourceNode.OBJE.TITL[NF_VALUE];
                }
            }
        }
        if (sourceNode.TEXT) {
            const paragraph = document.createElement("p");
            paragraph.innerHTML = sourceNode.TEXT[NF_VALUE];
            _container.appendChild(paragraph);
            if (sourceNode.TEXT.CONT) {
                sourceNode.TEXT.CONT.forEach(function(node) {
                    const cont = document.createElement("p");
                    cont.innerHTML = node[NF_VALUE];
                    _container.appendChild(cont);
                });
            }
            if (sourceNode.TEXT.CONC) {
                sourceNode.TEXT.CONC.forEach(function(node) {
                    const cont = document.createTextNode(" " + node[NF_VALUE]);
                    paragraph.appendChild(cont);
                });
            }
        }
        if (sourceNode.WWW) {
            const paragraph = document.createElement("p");
            paragraph.setAttribute("class", "dialogLink");
            const link = document.createElement("a");
            paragraph.appendChild(link);
            link.innerHTML = sourceNode.WWW[NF_VALUE]
            link.setAttribute("href", sourceNode.WWW[NF_VALUE]);
            link.setAttribute("target", "_blank");
            _container.appendChild(paragraph);
        }
        _dialogElement.showModal();
    }
}

NodeFamily.PersonForm = function(presenter, formSection) {
    const _presenter = presenter;
    const _formSection = formSection;
    const _form = _formSection.querySelector("form[name = 'personForm']");
    _presenter.subscribePersonForm(this);

    this.show = function() {
        _formSection.classList.add("active");
    }

    this.hide = function() {
        _formSection.classList.remove("active");
    }

    this.isActive = function() {
        return _formSection.classList.contains("active");
    }

    this.changeIsLiving = function(event) {
        const input = event.target;
        const deatSection = _formSection.querySelector('#DEAT');
        if (input.value == "Y") {
            input.checked = true;
            input.value = "";
            deatSection.classList.remove('active');
            _formSection.querySelector('#BURI').classList.remove('active');
        } else {
            input.checked = false;
            input.value = "Y";
            deatSection.classList.add('active');
        }
    }

    this.changeIsBuried = function(event) {
        const input = event.target;
        const buriSection = _formSection.querySelector('#BURI');
        if (input.value == "Y") {
            input.checked = false;
            input.value = "";
            buriSection.classList.remove('active');
        } else {
            input.checked = true;
            input.value = "Y";
            buriSection.classList.add('active');
        }
    }

    this.changeSex = function(event) {
        _form['SEX.nfValue'].value = event.target.value;
    }

    this.reset = function() {
        if (!_form) {
            return;
        }
        _form.querySelectorAll('.B').forEach(function(node) {node.classList.remove("active")});
        _form.querySelector("#isDEAT").closest(".B").classList.add("active");
        _form.reset();
        const hidden = _form.querySelectorAll('input[type="hidden"]');
        hidden.forEach(function(hidden) {
            hidden.value = "";
        });
        const fieldset = _formSection.querySelector('#extraGedcomFields');
        while (fieldset.children.length > 1) {
            fieldset.removeChild(fieldset.children[1]);
        }
        const img = _formSection.querySelector('#photo img');
        img.style.display = "none";
        const icon = _formSection.querySelector('#photo i');
        icon.classList.remove("M");
        icon.classList.remove("F");
        icon.classList.remove("U");
        icon.style.display = "block";
        const caption = _formSection.querySelector('#photo figcaption');
        caption.innerHTML = "";
        _formSection.querySelector("#submitterName").innerHTML = "";
        const familyName = _formSection.querySelector("#familyName");
        familyName.innerHTML = "";
        familyName.classList.remove("filled");
        const spouses = _formSection.querySelector("#spouses");
        while (spouses.children.length > 1) {
            spouses.removeChild(spouses.children[1]);
        }
        const wwwLink = _formSection.querySelector('#personWww');
        wwwLink.removeAttribute("href");
        wwwLink.innerHTML =  "";
        const el = _form['DEAT.nfValue'];
        el.value = "Y";
        el.dispatchEvent(new Event('change'));
    }
    const _that = this;
    const fillData = function(personNode, previous) {
        for (const [key, value] of Object.entries(personNode)) {
            if (key == NF_RECORD) {
                continue;
            }
            let inputName = "";
            if (previous) {
                inputName = previous + "." + key;
            } else {
                inputName = key;
            }
            if (typeof value === 'string' || value instanceof String) {
                let inputElement = _form[inputName];
                if (inputElement) {
                    if (inputName != "OBJE.FILE.nfValue" && inputName != "OBJE.TITL.nfValue" && inputName != "SEX.nfValue" && inputName) {
                        inputElement.closest(".B").classList.add("active");
                    }
                    NodeFamily.form.fillPhoto("photo", inputName, value);
                    inputElement.value = value;
                    inputElement.dispatchEvent(new Event('change'));
                    if (inputName == "NAME.nfValue") {
                        const name = value.replace(/\/(.+?)\//g,(match) => match.toUpperCase()).replace(/\//g, "");
                        inputElement.value = name;
                        document.getElementById("personHeader").innerHTML = name;
                    }
                    if (inputName == "BIRT.DATE.nfValue") {
                          NodeFamily.form.fillDatePhrase("BIRT.DATE", value);
                    }
                    if (inputName == "WWW.nfValue" && value && value.trim() != "") {
                        const wwwLink = _formSection.querySelector('#personWww');
                        wwwLink.setAttribute("href", value);
                        const name = value.length > 34 ? value.slice(0,35) + "(...)" : value;
                        wwwLink.innerHTML =  name;
                    }
                    if (inputName == "DEAT.nfValue") {
                        const el = _form['DEAT.nfValue'];
                        el.value = "N";
                        el.dispatchEvent(new Event('change'));
                        _formSection.querySelector("#isDEAT").value = "Y";
                    }
                    if (inputName == "DEAT.DATE.nfValue") {
                        NodeFamily.form.fillDatePhrase("DEAT.DATE", value);
                        _formSection.querySelector("#isDEAT").closest('.B').classList.remove("active")
                    }
                    if (inputName == "BURI.nfValue") {
                        const el = _form['BURI.nfValue'];
                        el.value = "";
                        el.dispatchEvent(new Event('change'));
                        _formSection.querySelector("#isBURI").value = value;
                    }
                    if (inputName == "SEX.nfValue") {
                        _formSection.querySelector("#SEX").value = value;
                        _formSection.querySelector("i").classList.add(value);
                    }
                    if (inputName == "SUBM.nfValue") {
                        _formSection.querySelector("#submitterName").innerHTML = _presenter.getName(value.replace(/@/g, ""));
                    }
                    if (inputName == "FAMC.nfValue") {
                        const familyName = _formSection.querySelector("#familyName");
                        familyName.innerHTML = _presenter.getFamilyNames(value);
                        familyName.classList.add("filled");
                        familyName.setAttribute("data-id", value);
                    }
                } else if(value.trim() != "") {
                    if (inputName.indexOf("FAMS.") != -1 && inputName.split('.').length < 4) {
                        let div = document.createElement("div");
                        let span = document.createElement("span");
                        span.setAttribute("class", "spouse");
                        span.setAttribute("data-id", value);
                        const name = _presenter.getFamilyNames(value);
                        span.innerHTML = name;
                        div.appendChild(span);
                        _formSection.querySelector('#spouses').appendChild(div);
                        _formSection.querySelector('#spouses').closest(".B").classList.add("active");
                    } else {
                        let label = document.createElement("label");
                        let labelValue = inputName.replace(".nfValue", "");
                        if (dict[labelValue]) {
                            labelValue = dict[labelValue];
                        } else {
                            const collLabel = labelValue.replace(/.\d/g, "")
                            if (dict[collLabel]) {
                                labelValue = dict[collLabel];
                            }
                        }
                        label.innerHTML = labelValue;
                        _formSection.querySelector('#extraGedcomFields').closest(".B").classList.add("active");
                        let extraInput = document.createElement("span");
                        extraInput.setAttribute("class", "active");
                        let val = value;
                        if (val.includes("@")) {
                            extraInput.setAttribute("data-id", val.replaceAll("@", ""));
                            extraInput.setAttribute("class", "clickable");
                            const sour = _presenter.getSourceTitle(val.replaceAll("@", ""));
                            val = val + " (" + sour + ")";
                            extraInput.addEventListener('click', _presenter.openSource, true);
                        }
                        if (inputName.indexOf("DATE") != -1) {
                            val = NodeFamily.Tree.changeDate(value, true);
                        }
                        extraInput.innerHTML = val;
                        const box = document.createElement("div");
                        box.setAttribute("class", "B active");
                        box.appendChild(label);
                        box.appendChild(extraInput);
                        _formSection.querySelector('#extraGedcomFields').appendChild(box);
                    }
                }
            } else if (!Array.isArray(value)) {
                fillData(value, inputName);
            } else {
                for (let i = 0; i < value.length; i++) {
                    fillData(value[i], inputName + "." + i);
                }
            }
        }
    }
    this.fill = function(id, personNode) {
        _form["id"].value = id;
        const shareButton = document.getElementById("share");
        shareButton.setAttribute("data-id", id);
        shareButton.setAttribute("data-lang", lang);
        fillData(personNode);
    }

    this.share = function(event) {
        const id = event.target.getAttribute("data-id");
        const lang = event.target.getAttribute("data-lang");
        const href = location.href;
        let link = href.substring(0, href.indexOf("?")) + "?id=" + id + "&lang=" + lang;
        const params = new URLSearchParams(window.location.search);
        if (params.has("ged")) {
            link += "&ged";
            if (params.get("ged") != "") {
                link += "=" + params.get("ged");
            }
        }
        navigator.clipboard.writeText(link);
        alert(dict["linkCopied"] + ": " + link + ". " + dict["justShare"]);
    }

    _formSection.querySelector("input[name='DEAT.nfValue']").addEventListener('change', this.changeIsLiving, true);
    _formSection.querySelector("input[name='BURI.nfValue']").addEventListener('change', this.changeIsBuried, true);
    _formSection.querySelector("#SEX").addEventListener('change', this.changeSex, true);
    _formSection.querySelectorAll("input").forEach(el => {
        el.addEventListener('change', (event) => {
            const span = _formSection.querySelector("span." + el.name.replaceAll(".", "-"));
            if (span) {
                span.textContent = event.target.value;
            }
        });
      });
    document.getElementById("share").addEventListener('click', this.share, true);
}

NodeFamily.PersonList = function(presenter, personListSection) {
    const _presenter = presenter;
    const _personListSection = personListSection;
    const _personListElement = _personListSection.querySelector("ul");
    const _offset = 50;
    let _from = 0;
    let _lunrIndex;
    let _persons;
    let _allPersons;
    let _familyData;

    this.show = function() {
        _personListSection.classList.add("active");
    }

    this.hide = function() {
        _personListSection.classList.remove("active");
    }

    this.setData = function(lunrIndex, familyData) {
        _lunrIndex = lunrIndex;
        _familyData = familyData;
        const persons = Object.fromEntries(Object.entries(familyData).filter(([key, value]) => value[NF_TYPE] == 'INDI'));
        _allPersons = _persons = Object.entries(persons).sort((a, b) => (a[1].NAME[NF_VALUE].replace(/\//g, " ") > b[1].NAME[NF_VALUE].replace(/\//g, " ")) ? 1 : -1);
    }

    this.fill = function(from) {
        if (from <0 || from >= _persons.length) {
            from = 0;
        }
        _from = from;
        let max = from + _offset;
        if (max >= _persons.length) {
            max = _persons.length;
        }
        for (let i = from; i < max; i++) {
            let position = i+1;
            let element = document.createElement("li");
            let person = _persons[i][1];
            let label = position + ". " + person.NAME[NF_VALUE].replace(/\//g, " ");
            if (person.BIRT && person.BIRT.DATE) {
                label += " " + NodeFamily.Tree.changeDate(person.BIRT.DATE[NF_VALUE]);
            }
            if (person.DEAT && person.DEAT.DATE) {
                label += " -" + NodeFamily.Tree.changeDate(person.DEAT.DATE[NF_VALUE]);
            }
            element.innerHTML = label;
            element.setAttribute("data-id", _persons[i][0]);
            _personListElement.appendChild(element);
            element.addEventListener('click', _presenter.startAndShow.bind(_presenter), true);
        }
        _personListSection.querySelector("#searchSize").innerHTML = "- " + _persons.length + " -";
        if (_persons.length < _offset) {
            _personListSection.querySelector(".buttonsWrapper").classList.remove("active");
        } else {
            _personListSection.querySelector(".buttonsWrapper").classList.add("active");
        }
    }
    this.reset = function() {
        _personListElement.innerHTML = "";
    }
    this.next = function() {
        this.reset();
        this.fill(_from + _offset)
    }
    this.prev = function() {
        this.reset();
        this.fill(_from - _offset)
    }
    this.filter = function(event) {
        const value = event.target.value;
        if (value.trim() == "") {
            _persons = _allPersons;
            this.reset();
            this.fill(0);
        }
        if (value.length < 3) {
            return;
        }
        try {
            const filtered = _lunrIndex.search(value);
            _persons = filtered.map(el => [el.ref, _familyData[el.ref]]);
            this.reset();
            this.fill(0);
        } catch(error) {}
    }
    _presenter.subscribePersonList(this);
    _personListSection.querySelector("#next").addEventListener('click', this.next.bind(this), true);
    _personListSection.querySelector("#prev").addEventListener('click', this.prev.bind(this), true);
    _personListSection.querySelector("#peopleListSearch").addEventListener('keyup', this.filter.bind(this), true);
}

NodeFamily.form = {};

NodeFamily.form.changeDate = function(dateName) {
    const accu = document.getElementById(dateName + ".ACCU").value;
    const day = document.getElementById(dateName + ".DD").value.trim();
    const month = document.getElementById(dateName + ".MM").value.trim();
    const year = document.getElementById(dateName + ".YYYY").value.trim();
    let value = "";
    if (day != "" || month != "" || year != "") {
        value += accu.trim() + " ";
    }
    if (day != "") {
        value += day + " ";
    }
    if (month != "") {
        value += month + " ";
    }
    if (year != "") {
        value += year + " ";
    }
    const andId = dateName.replace(".", "-") + "-AND";
    document.getElementById(andId).classList.remove('active');
    if (accu == "BET") {
        document.getElementById(andId).classList.add('active');
        const andDay = document.getElementById(dateName + ".AND.DD").value.trim();
        const andMonth = document.getElementById(dateName + ".AND.MM").value.trim();
        const andYear = document.getElementById(dateName + ".AND.YYYY").value.trim();
        if (andDay != "" || andMonth != "" || andYear != "") {
            value += "AND ";
        }
        if (andDay != "") {
            value += andDay + " ";
        }
        if (andMonth != "") {
            value += andMonth + " ";
        }
        if (andYear != "") {
            value += andYear + " ";
        }
    }
    if (dateName == 'MARR.DATE') {
        document.familyForm[dateName + '.nfValue'].value = value.trim();
    } else {
        document.personForm[dateName + '.nfValue'].value = value.trim();
    }
}

NodeFamily.form.fillPhoto = function(prefix, dataKey, value) {
    if (dataKey == "OBJE.0.FILE.nfValue") {
        const photoInput = document.getElementById(prefix + "File");
        photoInput.style.display = "none";
        const photoInputColl = document.getElementById(prefix + "FileColl");
        photoInputColl.style.display = "";
    }
    if (dataKey == "OBJE.FILE.nfValue") {
        const photoInput = document.getElementById(prefix + "File");
        photoInput.style.display = "";
        const photoInputColl = document.getElementById(prefix + "FileColl");
        photoInputColl.style.display = "none";
        const icon = document.querySelector("#" + prefix + " i");
        if (icon) {
            icon.style.display = "none";
        }
    }
    if (dataKey == "OBJE.0.TITL.nfValue") {
        const photoCaptionInput = document.getElementById(prefix + "Titl");
        photoCaptionInput.style.display = "none";
        const photoCaptionInputColl = document.getElementById(prefix + "TitlColl");
        photoCaptionInputColl.style.display = "";
    }
    if (dataKey == "OBJE.TITL.nfValue") {
        const photoCaptionInputColl = document.getElementById(prefix + "TitlColl");
        photoCaptionInputColl.style.display = "none";
        const photoCaptionInput = document.getElementById(prefix + "Titl");
        photoCaptionInput.style.display = "";
    }
    const inputElement = document.querySelector("input[name='" + dataKey + "']");
    if (inputElement) {
        const figure = document.getElementById(prefix);
        if (dataKey == "OBJE.FILE.nfValue" || dataKey == "OBJE.0.FILE.nfValue") {
            if (!document.getElementById(value)) {
                const img = document.createElement("img");
                img.setAttribute("src", value);
                img.setAttribute("onerror", "this.src = ''")
                img.setAttribute("id", value);
                document.body.appendChild(img);
            }
            const anchor = document.createElement("a");
            anchor.setAttribute("href", value);
            anchor.setAttribute("target", "_blank");
            anchor.appendChild(document.getElementById(value));
            figure.insertBefore(anchor, figure.firstChild);
            document.getElementById(value).style.display = "";
        }
        if (dataKey == "OBJE.TITL.nfValue" || dataKey == "OBJE.0.TITL.nfValue") {
            const caption = document.querySelector("#" + prefix + " figcaption");
            const img = document.querySelector("#" + prefix + ' img');
            if (img) {
                caption.innerHTML = value;
            }
        }
    }
}

NodeFamily.form.fillDate = function(prefix, value) {
    const dateElements = value.split(" ");
    const month = dateElements.find(el => ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].includes(el));
    const clazz = (prefix).replaceAll(".", "-");
    const span = document.querySelector("span." + clazz);
    if (span) {
        span.innerHTML = NodeFamily.Tree.changeDate(value, true);
    }
}

NodeFamily.form.fillDatePhrase = function(prefix, value) {
    const dateElements = value.split(" ");
    const phrase = dateElements.find(el => ["ABT", "AFT", "BEF", "BET", "CAL", "EST"].includes(el));
    NodeFamily.form.fillDate(prefix, value);
    if (phrase) {
        document.getElementById(prefix + '.ACCU').value = phrase;
        if (phrase == "BET") {
            NodeFamily.form.fillDate(prefix + '.AND', value.substr(value.indexOf('AND'), value.length));
        } else {
            document.getElementById(prefix.replace(".", "-") + '-AND').classList.remove('active');
        }
    }
}

NodeFamily.ExportForm = function(presenter, formSection) {
    const _presenter = presenter;
    const _formSection = formSection;
    const _form = document.querySelector('form[name="exportForm"]');
    _presenter.subscribeExportForm(this);

    this.show = function() {
        _formSection.classList.add("active");
    }

    this.hide = function() {
        _formSection.classList.remove("active");
    }

    this.fill = function(head) {
        if (head.SUBM) {
            _form['SUBM.nfValue'].value = head.SUBM[NF_VALUE];
            if (head.SUBM.NAME) {
                _form["SUBM.NAME.nfValue"].value = head.SUBM.NAME[NF_VALUE];
            }
        }
    }
}

NodeFamily.FamilyForm = function(presenter, formSection) {
    const _presenter = presenter;
    const _formSection = formSection;
    const _form = _formSection.querySelector("form[name = 'familyForm']");
    _presenter.subscribeFamilyForm(this);

    this.show = function() {
        _formSection.classList.add("active");
    }

    this.hide = function() {
        _formSection.classList.remove("active");
    }

    this.isActive = function() {
        return _formSection.classList.contains("active");
    }

    this.reset = function() {
        if (!_form) {
            return;
        }
        _form.reset();
         _form.querySelectorAll('.B').forEach(function(node) {node.classList.remove("active")});
        const hidden = _form.querySelectorAll('input[type="hidden"]');
        hidden.forEach(function(hidden) {
            hidden.value = "";
        });
        const fieldset = _formSection.querySelector('#extraFamilyFields');
        while (fieldset.children.length > 1) {
            fieldset.removeChild(fieldset.children[1]);
        }
        const img = _formSection.querySelector('#photoFamily img');
        img.style.display = "none";
        const icon = _formSection.querySelector('#photoFamily i');
        icon.style.display = "block";
        const caption = _formSection.querySelector('#photoFamily figcaption');
        caption.innerHTML = "";
        const wifeName = _formSection.querySelector("#wifeName");
        wifeName.innerHTML = "";
        wifeName.classList.remove("filled");
        const husbandName = _formSection.querySelector("#husbandName");
        husbandName.innerHTML = "";
        husbandName.classList.remove("filled");
        const children = _formSection.querySelector("#children");
        while (children.children.length > 1) {
            children.removeChild(children.children[1]);
        }
    }

    const fillData = function(personNode, previous) {
        for (const [key, value] of Object.entries(personNode)) {
            if (key == NF_RECORD) {
                continue;
            }
            let inputName = "";
            if (previous) {
                inputName = previous + "." + key;
            } else {
                inputName = key;
            }
            if (typeof value === 'string' || value instanceof String) {
                let inputElement = _form[inputName];
                if (inputElement) {
                    NodeFamily.form.fillPhoto("photoFamily", inputName, value);
                    inputElement.value = value;
                    inputElement.dispatchEvent(new Event('change'));
                    if (inputName != "OBJE.FILE.nfValue" && inputName != "OBJE.TITL.nfValue" && inputName) {
                        inputElement.closest(".B").classList.add("active");
                    }
                    if (inputName == "HUSB.nfValue") {
                        const husbandName = _formSection.querySelector('#husbandName');
                        husbandName.innerHTML = _presenter.getName(value);
                        husbandName.classList.add("filled")
                        husbandName.setAttribute("data-id", value);
                    }
                    if (inputName == "WIFE.nfValue") {
                        const wifeName = _formSection.querySelector('#wifeName');
                        wifeName.innerHTML = _presenter.getSurname(value);
                        wifeName.classList.add("filled");
                        wifeName.setAttribute("data-id", value);
                    }
                    if (inputName == "MARR.DATE.nfValue") {
                          NodeFamily.form.fillDatePhrase("MARR.DATE", value);
                    }
                } else if(value.trim() != "") {
                    if (inputName.indexOf("CHIL.") != -1 && inputName.split('.').length < 4) {
                        let div = document.createElement("div");
                        let extraInput = document.createElement("input");
                        extraInput.setAttribute("type", "hidden");
                        extraInput.setAttribute("name", inputName);
                        extraInput.setAttribute("class", "data");
                        extraInput.setAttribute("size", "1");
                        extraInput.setAttribute("style", "width:auto");
                        extraInput.value = value;
                        div.appendChild(extraInput);
                        let span = document.createElement("span");
                        span.setAttribute("class", "child");
                        span.setAttribute("data-id", value);
                        const name = _presenter.getName(value);
                        span.innerHTML = name;
                        div.appendChild(span);
                        _formSection.querySelector('#children').appendChild(div);
                        _formSection.querySelector('#children').closest(".B").classList.add("active");
                    } else {
                        let label = document.createElement("label");
                        let labelValue = inputName.replace(".nfValue", "");
                        if (dict[labelValue]) {
                            labelValue = dict[labelValue];
                        }
                        label.innerHTML = labelValue;
                        _formSection.querySelector('#extraFamilyFields').appendChild(label);
                        let extraInput = document.createElement("input");
                        extraInput.setAttribute("type", "text");
                        extraInput.setAttribute("name", inputName);
                        extraInput.setAttribute("class", "active");
                        extraInput.setAttribute("disabled", "");
                        let val = value;
                        if (val.includes("@")) {
                            const sour = _presenter.getSourceTitle(val.replaceAll("@", ""));
                            val = val + " (" + sour + ")";
                        }
                        extraInput.value = val;
                        _formSection.querySelector('#extraFamilyFields').appendChild(extraInput);
                        _formSection.querySelector('#extraFamilyFields').closest(".B").classList.add("active");
                    }
                }
            } else if (!Array.isArray(value)) {
                fillData(value, inputName);
            } else {
                for (let i = 0; i < value.length; i++) {
                    fillData(value, inputName);
                }
            }
        }
    }

    this.fill = function(id, personNode) {
        _form["id"].value = id;
        fillData(personNode);
        const header = document.getElementById("familyHeader");
        header.innerHTML = _presenter.getFamilyNames(id);
    }
    _formSection.querySelectorAll("input").forEach(el => {
        el.addEventListener('change', (event) => {
            const span = _formSection.querySelector("span." + el.name.replaceAll(".", "-"));
            if (span) {
                span.textContent = event.target.value;
            }
        });
      });
}

NodeFamily.addVectorWithFrom = function(from, to, tree) {
    tree.pushNode(from);
    tree.pushEdge(from, to);
}

NodeFamily.addVectorWithTo = function(from, to, tree) {
    tree.pushNode(to);
    tree.pushEdge(from, to);
}

NodeFamily.addSiblings = function(data, parentsId, startPoint, config, tree) {
    let siblings =  data[parentsId] && data[parentsId].CHIL || [];
    siblings.forEach(function(sibling) {
        if (sibling != startPoint) {
            let numberOfOtherGens = config.numberOfOtherGens;
            if (numberOfOtherGens > 0) {
                NodeFamily.addVectorWithTo(parentsId, sibling[NF_VALUE], tree);
            }
            if (numberOfOtherGens > 1) {
                const cfg = Object.assign({}, config);
                cfg.numberOfOtherGens = numberOfOtherGens - 1;
                NodeFamily.addChildren(data, sibling[NF_VALUE], cfg, tree);
            }
        }
    });
}

NodeFamily.addFamily = function(family, spouseId, tree) {
    if (family) {
        if (family.HUSB) {
            NodeFamily.addVectorWithFrom(family.HUSB[NF_VALUE], spouseId, tree);
        }
        if (family.WIFE) {
            NodeFamily.addVectorWithFrom(family.WIFE[NF_VALUE], spouseId, tree);
        }
    }
}

NodeFamily.addParentsWithSiblings = function(data, startPoint, config, tree) {
    const numberOfParentGens = config.numberOfParentGens;// || 1;
    const numberOfOtherGens = config.numberOfOtherGens;// || 0;
    if (data[startPoint] && data[startPoint].FAMC) {
        const family = data[data[startPoint].FAMC[NF_VALUE]];
        const parentsId = data[startPoint].FAMC[NF_VALUE];
        NodeFamily.addVectorWithFrom(parentsId, startPoint, tree);
        NodeFamily.addFamily(family, parentsId, tree);
        NodeFamily.addSiblings(data, parentsId, startPoint, config, tree);
        if (numberOfParentGens > 1) {
            const cfg = Object.assign({}, config);
            cfg.numberOfParentGens = numberOfParentGens - 1;
            cfg.numberOfOtherGens = numberOfOtherGens - 1;
            if (family.HUSB) {
                NodeFamily.addParentsWithSiblings(data, family.HUSB[NF_VALUE], cfg, tree);
            }
            if (family.WIFE) {
                NodeFamily.addParentsWithSiblings(data, family.WIFE[NF_VALUE], cfg, tree);
            }
        }
    }
    if (data[startPoint] && data[startPoint].HUSB) {
        const parentId = data[startPoint].HUSB[NF_VALUE];
        NodeFamily.addVectorWithFrom(parentId, startPoint, tree);
        if (numberOfParentGens > 1) {
            const cfg = Object.assign({}, config);
            cfg.numberOfParentGens = numberOfParentGens - 1;
            cfg.numberOfOtherGens = numberOfOtherGens - 1;
            NodeFamily.addParentsWithSiblings(data, parentId, cfg, tree);
        }
    }
    if (data[startPoint] && data[startPoint].WIFE) {
        const parentId = data[startPoint].WIFE[NF_VALUE];
        NodeFamily.addVectorWithFrom(parentId, startPoint, tree);
        if (numberOfParentGens > 1) {
            const cfg = Object.assign({}, config);
            cfg.numberOfParentGens = numberOfParentGens - 1;
            cfg.numberOfOtherGens = numberOfOtherGens - 1;
            NodeFamily.addParentsWithSiblings(data, parentId, cfg, tree);
        }
    }
}

NodeFamily.addChildren = function(data, startPoint, config, tree) {
    const numberOfChildGens = config.numberOfChildGens || 0;
    if (numberOfChildGens == 0) {
        return;
    }
    const spouses = data[startPoint] && data[startPoint].FAMS || [];
    spouses.forEach(function(spouseData) {
        const spouseId = spouseData[NF_VALUE];
        const spouse = data[spouseData[NF_VALUE]];
        if (!spouse) {
            return;
        }
        tree.pushNode(spouseId);
        NodeFamily.addFamily(spouse, spouseId, tree);
        const childrenIds = spouse && spouse.CHIL || [];
        childrenIds.forEach(function(childrenId) {
            if (numberOfChildGens >= 1) {
                NodeFamily.addVectorWithTo(spouseId, childrenId[NF_VALUE], tree);
                const cfg = Object.assign({}, config);
                cfg.numberOfChildGens = numberOfChildGens - 1;
                NodeFamily.addChildren(data, childrenId[NF_VALUE], cfg, tree);
            }
        });
    });
    const children = data[startPoint] && data[startPoint].CHIL || [];
    children.forEach(function(childData) {
        const childId = childData[NF_VALUE];
        const child = data[childData[NF_VALUE]];
        if (!child) {
            return;
        }
        tree.pushNode(childId);
        NodeFamily.addVectorWithFrom(startPoint, childId, tree);
        if (numberOfChildGens >= 1) {
            const cfg = Object.assign({}, config);
            cfg.numberOfChildGens = numberOfChildGens - 1;
            NodeFamily.addChildren(data, childId, cfg, tree);
        }
    });
}

NodeFamily.searchPerson = function(idx, familyData, value) {
    let result = []
    try {
        result = idx.search(value.trim());
    } catch (error) {}
    let dataListElement = document.getElementById("datalist");
    if (result.length > 0) {
        dataListElement.classList.add("active");
    } else {
        dataListElement.classList.remove("active");
    }
    if (result.length < 5) {
        dataListElement.setAttribute("size", result.length + 1);
    } else {
        dataListElement.setAttribute("size", 5);
    }
    let fragment = document.createDocumentFragment();
    for (let i = 0; i < result.length; i++) {
        let idx = i+1;
        let element = result[i];
        let id  = element.ref;
        let node = document.createElement("option");
        let label = idx + ") " + familyData[id].NAME[NF_VALUE].replace(/\//g, "").trim();
        if (familyData[id].BIRT && familyData[id].BIRT.DATE) {
            label += " " + NodeFamily.Tree.changeDate(familyData[id].BIRT.DATE[NF_VALUE]);
        }
        if (familyData[id].DEAT && familyData[id].DEAT.DATE) {
            label += " - " + NodeFamily.Tree.changeDate(familyData[id].DEAT.DATE[NF_VALUE]);
        }
        node.setAttribute("value", id);
        node.innerHTML = label;
        fragment.appendChild(node);
    }
    dataListElement.appendChild(fragment);
}

NodeFamily.Tree = function() {

    const _tree = {};
    _tree.nodes = [];
    _tree.edges = [];

    this.pushNode = function(node) {
        _tree.nodes.push(node);
    }

    this.pushEdge = function(from, to) {
        _tree.edges.push({from: from, to: to});
    }

    this.setEdges = function(graphlib) {
        _tree.edges.forEach(function(edge) {
            graphlib.setEdge(edge.from, edge.to, {});
        });
    }

    this.removeNodes = function(graphlib) {
        _tree.nodes.forEach(function(node) {
            graphlib.removeNode(node);
        });
    }

    this.addNodes = function(graphlib, data, startPoint) {
        _tree.nodes.forEach(function(id) {
            const node = {};
            const value = data[id];
            node.labelType="html";
            const isPerson = value[NF_TYPE] == 'INDI';
            const isFamily = value[NF_TYPE] == 'FAM';
            if (isPerson) {
                node.label = "";
                if (value.TITL) {
                    node.label += value.TITL[NF_VALUE] + "<br/>";
                }
                if (value.SEX && value.SEX[NF_VALUE] == "M") {
                    node.label += " &#9794; ";
                }
                if (value.SEX && value.SEX[NF_VALUE] == "F") {
                    node.label += " &#9792; ";
                }
                if (value.NAME && value.NAME.GIVN && value.NAME.SURN) {
                    node.label += value.NAME.GIVN[NF_VALUE] + " " +  value.NAME.SURN[NF_VALUE];
                }
                else if (value.NAME) {
                   node.label += value.NAME[NF_VALUE].replace(/\//g, " ");
                }
                if (value.NAME && value.NAME.NICK) {
                    node.label += "<br/>(" + value.NAME.NICK[NF_VALUE] + ")";
                }
                if (value.BIRT) {
                    node.label += "<br/><span class='' style=\"font-size: smaller;font-family:'font-awesome'\">&#xf004</span>";
                }
                if (value.BIRT && value.BIRT.DATE) {
                    node.label += " " + NodeFamily.Tree.changeDate(value.BIRT.DATE[NF_VALUE]) + ",";
                }
                if (value.BIRT && value.BIRT.PLAC) {
                    node.label += " " + value.BIRT.PLAC[NF_VALUE];
                }
                if (value.DEAT) {
                    node.label += "<br/><span class='' style=\"font-size: smaller;font-family:'font-awesome'\">&#xf4ba</span>";
                }
                if (value.DEAT && value.DEAT.DATE) {
                    node.label += " " + NodeFamily.Tree.changeDate(value.DEAT.DATE[NF_VALUE]);
                }
                if (value.DEAT && value.DEAT.PLAC) {
                    node.label += ", " + value.DEAT.PLAC[NF_VALUE];
                }
                if (value.BURI) {
                    node.label += "<br/> &#10829; ";
                }
                if (value.BURI && value.BURI.PLAC) {
                    node.label += value.BURI.PLAC[NF_VALUE];
                }
                node.label += '<div class="fas personLink">&nbsp;</div>';
            }
            if (isFamily) {
                const husband = value.HUSB ? data[value.HUSB[NF_VALUE]] : null;
                const wife = value.WIFE ? data[value.WIFE[NF_VALUE]] : null;
                node.label = "";
                if (wife) {
                    if (wife.NAME && wife.NAME.GIVN) {
                        node.label = wife.NAME.GIVN[NF_VALUE].split(" ")[0];
                    } else if(wife.NAME) {
                        node.label = wife.NAME[NF_VALUE].replace(/\//g, " ");
                    }
                }
                if (wife && husband) {
                    node.label += "<br/> & <br/>";
                }
                if (husband) {
                    if (husband.NAME && husband.NAME.GIVN && husband.NAME.SURN) {
                        node.label += husband.NAME.GIVN[NF_VALUE].split(" ")[0] + " " + husband.NAME.SURN[NF_VALUE];
                    } else if(husband.NAME){
                        node.label += husband.NAME[NF_VALUE].replace(/\//g, " ");;
                    }
                }
                if (value.MARR) {
                    if (value.MARR.DATE) {
                        node.label += "</br> &#9901; " + NodeFamily.Tree.changeDate(value.MARR.DATE[NF_VALUE]);
                    }
                    if (value.MARR.PLAC) {
                        node.label += ",<br/>" + value.MARR.PLAC[NF_VALUE];
                    }
                }
                if (value.DIV && value.DIV.nfValue != "N") {
                    node.label += "</br>&#9902;";
                }
            }
            node.rx = node.ry = 10;
            if (value.SEX && value.SEX[NF_VALUE] == "M") {
                node.style = "fill: var(--auraData, hsl(0, 0%, 100%));stroke: var(--accentMale, hsl(195, 100%, 80%)); stroke-width: 2px";
            } else if (value.SEX && value.SEX[NF_VALUE] == "F") {
                node.style = "fill: var(--auraData, hsl(0, 0%, 100%));stroke: var(--accentFemale, hsl(348, 80%, 83%)); stroke-width: 2px";
            } else {
                node.style = "fill: var(--auraData, hsl(0, 0%, 100%)); stroke: url(#gender); stroke-width: 2px";
            }
            if (!isPerson) {
                node.shape = "circle";
                node.style = "fill: var(--auraData, hsl(0, 0%, 100%));stroke: var(--accentFamily, hsl(52, 100%, 49%)); stroke-width: 2px";
            }
            if (id == startPoint) {
                node.style = "fill: var(--auraNodeCurrent, hsl(64, 100%, 42%)); stroke-width: 2px";
                node.labelStyle = "color: var(--on-auraNodeCurrent, hsl(213, 13%, 14%))";
            }
            graphlib.setNode(id, node);
        });
    }
}

NodeFamily.Tree.changeDate = function(date, long) {
    const lang = params.get("lang") || "en";
    let newDate = date;
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    months.forEach(function(month, idx) {
        if (date.indexOf(month) != -1) {
            let translated = new Date(2020, idx);
            if (long) {
                translated = translated.toLocaleString(lang, { month: 'long'});
            } else {
                translated = translated.toLocaleString(lang, { month: 'short'}).toUpperCase();
            }
            newDate = newDate.replace(month, translated);
        }
    });
    return newDate.replace("ABT", "&#8776;").replace("EST", "&#916;").replace("CAL", "&#177;").replace("AFT", "&#8805;").replace("BEF", "&#8804;").replace("BET", "").replace("AND", "&#8660;");
}

NodeFamily.toggleControls = function(event) {
    event.target.parentNode.querySelector(".tooltiptext").style.visibility = "hidden";
    document.getElementById("controls").classList.toggle("active");
}
NodeFamily.toggleSearch = function(event) {
    document.getElementById("search").classList.toggle("active");
}
NodeFamily.fromFile = function(file) {
    const fileReader = new FileReader();
    fileReader.onload = function(loadFileEvent) {
        const gedcomData = loadFileEvent.target.result;
        NodeFamily.fromData(gedcomData);
    }
    fileReader.readAsText(file);
}

NodeFamily.fromData = function(data, id, graphConfig, config) {
    let gConfig = graphConfig || {rankdir: 'TB', edgesep: 10, ranksep: 25, nodesep: 10};
    const gedcom = new Gedcom(data);
    const jsonData = gedcom.toJson();
    const nodeFamily = new NodeFamily(jsonData, d3, dagreD3);
    nodeFamily.setGraph(gConfig);
    if (config) {
        nodeFamily.setConfig(config);
    }
    const personForm = new NodeFamily.PersonForm(nodeFamily, document.getElementById('editForm'));
    const familyForm = new NodeFamily.FamilyForm(nodeFamily, document.getElementById('editFamilyForm'));
    const exportForm = new NodeFamily.ExportForm(nodeFamily, document.getElementById('exportForm'));
    const personList = new NodeFamily.PersonList(nodeFamily, document.getElementById('personList'));
    const sourceDialog = new NodeFamily.SourceDialog(nodeFamily, document.getElementById('sourceDialog'));
    document.querySelector('#toggleForm').addEventListener('click', nodeFamily.openDataCard, true);
    document.querySelector('#toggleExportForm').addEventListener('click', nodeFamily.toggleExportForm, true);
    document.querySelector('#togglePersonList').addEventListener('click', nodeFamily.togglePersonList, true);
    document.getElementById("intro").style.display = "none";
    document.getElementById("content").style.display = "block";
    document.querySelector('#toggleForm').click();
    if (id) {
        nodeFamily.visualize(id);
    } else {
        nodeFamily.visualize();
    }
    window.addEventListener("popstate", (event) => {
        if (event.state) {
            nodeFamily.visualize(event.state.start, true);
        }
    }, true);
    nodeFamily.fillHead();
}
NodeFamily.init = function(path, lang, callback) {
    fetch(path + 'html/body.html')
    .then(response => response.text())
    .then((data) => {
        document.body.innerHTML = data;
        document.getElementById("homeLink").setAttribute("href", "index.html?lang=" + lang);
        fetch(path + 'js/' + lang + '.json')
        .then(response => response.json())
        .then((data) => {
            dict = data;
            document.querySelectorAll(".t9n").forEach(el => {
                const key = el.getAttribute("t9n-key");
                const attrs = el.getAttribute("t9n-attrs");
                if (attrs) {
                    const attributes = attrs.split(" ");
                    attributes.forEach(attribute => {
                        const attrKey = key + "-" + attribute;
                        el.setAttribute(attribute, data[attrKey]);
                    });
                }
                if (data[key]) {
                    el.innerHTML = data[key];
                }
            });

            const headerHeight = document.getElementById("header").offsetHeight;
            workspaceHeight = clientHeight - headerHeight;
            document.getElementById("content").style.height = workspaceHeight + "px";
            document.getElementById("svgId").setAttribute("height",workspaceHeight);

            function handleGedcom(inputChangeEvent) {
                d3.select("svg > g > *").remove(); // ! important !
                resetControls();
                const file = inputChangeEvent.target.files[0];
                if (file) {
                    NodeFamily.fromFile(file);
                    document.getElementById('gedcomFileInput').disabled = true;
                    document.getElementById("gedcomFileInput").parentElement.addEventListener('click',
                    function() {
                        if (confirm("You clicked to open new GEDCOM file. We are to refresh the page first. You will lose the current tree view.")) document.location.reload(true);
                    });
                } else {
                    alert("Failed to load file");
                }
            }
            document.getElementById('gedcomFileInput').addEventListener('change', handleGedcom, false);
            document.getElementById('toggleControls').addEventListener('click', NodeFamily.toggleControls, true);
            document.getElementById('toggleSearch').addEventListener('click', NodeFamily.toggleSearch, true);
            if (callback) {
                callback();
            }
        });
    });
}
const resetControls = function() {
    document.getElementById('numberOfParentGens').value = 1;
    document.getElementById('numberOfChildrenGens').value = 1;
    document.getElementById('numberOfOtherGens').value = 1;
    document.getElementById('orientation').checked = false;
}