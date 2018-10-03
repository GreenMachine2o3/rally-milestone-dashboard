Ext.define('Milestone Progress Dashboard', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    store: undefined,
    userStoryStore: undefined,
    milestoneStore: undefined,
    grid: undefined,
    milestoneComboBox: undefined,
    pointsRemaining: [],
    refinedPercentage: [],
    selectedIter: undefined,
    milestones: [],
    targetDates: [],
    milestonesUsed: [],
    milestoneNumber: undefined,
    grids: [],
    gridsMade: 0,
    header: undefined,
    container: undefined,
    //used to determine when we have searched every milestone
    milestonesRemaining: undefined,

    featuresByMilestone: [],

    totalRefinedPercent: [],
    totalProgressPercent: [],

    projects: [],
    projectHasPreState: [],

    refinedProgressBar: undefined,

    listeners: {
        resize: function(){
            if(this.container && this.window) {
                this.container.setWidth(this.window.innerWidth);
                this.grids.forEach(function (value) {
                    value.setWidth(this.window.innerWidth);
                });
            }
        },
        afterRender: function(){
            this.container = Ext.create('Ext.panel.Panel');
            this.setLoading(true, false);
        }
    },

    launch: function() {
        this.header = Ext.create('Ext.panel.Header',{
            title: 'Milestone Progress',
            titleAlign: 'center',
            height:40,
            style: 'font-size: 1.6em;'
        });
        this.refinedProgressBar = Ext.create('Rally.ui.renderer.template.progressbar.PercentDoneByStoryPlanEstimateTemplate',{
            percentDoneName: 'PointsRemainingRefined'
        });
        this.refinedProgressBar.setCalculateColorFn(function(recordData){
            var percentDone = recordData[this.percentDoneName];
            percentDone = Math.round(percentDone * 100);
            if(percentDone === 0){
                return '#E0E0E0';
            } else if(percentDone <= 33){
                return '#F66349';
            }else if(percentDone <= 66){
                return '#FAD200';
            }else if(percentDone !== 100){
                return '#8DC63F';
            }else{
                return '#D1D1D1';
            }
        });
        this.getProjects();
    },
    getProjects: function(){
        var projectList = [];
        var xhr = new XMLHttpRequest();
        var url = 'https://rally1.rallydev.com/slm/webservice/v2.0/project/';
        xhr.open('GET', url);
        xhr.setRequestHeader('Content-type', 'application/json');
        var that = this;
        xhr.onreadystatechange = function() {
            //Call a function when the state changes.
            if(xhr.readyState === 4 && xhr.status === 200) {
                that.projects = JSON.parse(xhr.responseText).QueryResult.Results;
                for(var i = 0; i < that.projects.length; i++){
                    that.getProjectScheduleState(that.projects[i]);
                }
            }
        };
        xhr.send();
    },
    getProjectScheduleState: function(project){
        project._ref = project._ref.substring(project._ref.indexOf("/project"), project._ref.length);
        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            context: {
                project: project._ref,
                projectScopeUp: false,
                projectScopeDown: false
            },
            success: function(model){
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        if(records[0].get('StringValue') === 'Defined'){
                            this.projectHasPreState[project._ref] = [false];
                        }
                        else{
                            this.projectHasPreState[project._ref] = [true];
                        }
                        if(Object.keys(this.projectHasPreState).length === this.projects.length){
                            this._loadReleases();
                        }
                    },
                    scope: this
                });
            },
            scope: this
        });
    },
    _loadReleases: function(){
        const milestoneStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Milestone',
            limit: Infinity,
            autoLoad:true,
            listeners: {
                load: function(store, data) {
                    this.milestoneNumber = data.length-1;
                    for(var i = 0; i < data.length; i++){
                        if(this.milestones.length === 0){
                            this.milestones.push(data[i].data.Name);
                            this.targetDates.push(data[i].data.TargetDate);
                        }
                        else {
                            for (var j = 0; j < this.milestones.length; j++) {
                                if(this.milestones[j] === data[i].data.Name){
                                    break;
                                }
                                if(j === this.milestones.length-1){
                                    this.milestones.push(data[i].data.Name);
                                    this.targetDates.push(data[i].data.TargetDate);
                                }
                            }
                        }
                    }
                    this.sortMilestones(this.milestones, this.targetDates);
                },
                scope:this
            }
        });
    },
    getMonthNumber: function(month){
       if(month === "Jan"){
           return 1;
       }
       else if(month === "Feb"){
           return 2;
       }
       else if(month === "Mar"){
           return 3;
       }
       else if(month === "Apr"){
           return 4;
       }
       else if(month === "May"){
           return 5;
       }
       else if(month === "Jun"){
           return 6;
       }
       else if(month === "Jul"){
           return 7;
       }
       else if(month === "Aug"){
           return 8;
       }
       else if(month === "Sep"){
           return 9;
       }
       else if(month === "Oct"){
           return 10;
       }
       else if(month === "Nov"){
           return 11;
       }
       else if(month === "Dec"){
           return 12;
       }
       else{
           return 0;
       }
    },
    isGreater: function(date1, date2){
        if(date1 && !date2){
            return true;
        }
        else if(!date1){
            return false;
        }
        else{
            var newDate1 = date1.toString().split(" ");
            var newDate2 = date2.toString().split(" ");
            if(newDate1[3] > newDate2[3]){
                return true;
            }
            else if(newDate1[3] < newDate2[3]){
                return false;
            }
            else if (this.getMonthNumber(newDate1[1]) > this.getMonthNumber(newDate2[1])){
                return true;
            }
            else if (this.getMonthNumber(newDate1[1]) < this.getMonthNumber(newDate2[1])){
                return false;
            }
            else if(newDate1[2] > newDate2[2]){
                return true;
            }
            else if(newDate1[2] < newDate2[2]){
                return false;
            }
            else{
                return false;
            }
        }
    },
    sortMilestones: function(milestones, targetDates){
        for(var i = 0; i < milestones.length-1; i++){
            for(var j = 0; j < milestones.length-i-1; j++){
                if(this.isGreater(targetDates[j], targetDates[j+1])){
                    var tempMile = milestones[j];
                    var tempDate = targetDates[j];
                    milestones[j] = milestones[j+1];
                    targetDates[j] = targetDates[j+1];
                    milestones[j+1] = tempMile;
                    targetDates[j+1] = tempDate;
                }
            }
        }
        this.getFeatures();
    },
    getFeatures: function(){
        const mystore = Ext.create('Rally.data.wsapi.Store', {
            model: 'portfolioitem/feature',
            context: {
                projectScopeUp: false
            },
            listeners: {
                load: function(store, data) {
                    var milestonesFound = 0;
                    for(var i = 0; i < data.length; i++){
                        if(data[i].data.Milestones.Count === 0){
                            if (this.featuresByMilestone[1000000]) {
                                this.featuresByMilestone[1000000].push(data[i]);
                            }
                            else {
                                this.milestonesUsed[1000000] = null;
                                milestonesFound++;
                                this.featuresByMilestone[1000000] = [data[i]];
                            }
                        }
                        else {
                            for (var j = 0; j < data[i].data.Milestones._tagsNameArray.length; j++) {
                                for (var k = 0; k < this.milestones.length; k++) {
                                    if (data[i].data.Milestones._tagsNameArray[j].Name === this.milestones[k]) {
                                        if (this.featuresByMilestone[k]) {
                                            this.featuresByMilestone[k].push(data[i]);
                                        }
                                        else{
                                            this.milestonesUsed[k] = this.milestones[k];
                                            milestonesFound++;
                                            this.featuresByMilestone[k] = [data[i]];
                                        }
                                    }
                                }
                            }
                        }
                    }
                    var milestonesUsedSorted = [];
                    this.milestonesUsed.forEach(function (value) {
                        milestonesUsedSorted.push(value);
                    });
                    this.milestonesUsed = milestonesUsedSorted;
                    var featuresByMilestoneSorted = [];
                    this.featuresByMilestone.forEach(function (value) {
                        featuresByMilestoneSorted.push(value);
                    });
                    this.featuresByMilestone = featuresByMilestoneSorted;
                    this.getUserStoryData(store, this.featuresByMilestone, milestonesFound);
                },
                scope: this
            },
            autoLoad: true,
            fetch: ['FormattedID', 'Name', 'PercentDoneByStoryPlanEstimate', 'RefinedEstimate', 'LeafStoryPlanEstimateTotal', 'Project', 'Release', 'Milestones']
        });
    },
    getUserStoryData: function(_store, _data, milestoneNumber){
        this.pointsRemaining = [];
        const userStoryStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'User Story',
            limit: Infinity,
            context: {
                workspace: this.getContext().getWorkspaceRef(),
                project: null
            },
            fetch: ['Feature', 'PlanEstimate', 'ScheduleState', 'Parent'],
            listeners: {
                load: function (store, data) {
                    if (data) {
                        var preDefinedState = false;
                        for (var h = 0; h < _data.length; h++) {
                            var totalTotals = 0;
                            var totalRefined = 0;
                            var totalAccepted = 0;
                            for (var i = 0; i < _data[h].length; i++) {
                                var remainingPoints = 0;
                                var totalPoints = 0;
                                var refinedPoints = 0;
                                var acceptedPoints = 0;
                                preDefinedState = this.projectHasPreState[_data[h][i].data.Project._ref] ? this.projectHasPreState[_data[h][i].data.Project._ref][0] : true;
                                for (var j = 0; j < data.length; j++) {
                                    if (data[j].data.Feature !== null && data[j].data.Feature._ref === _data[h][i].data._ref) {
                                        //only want remaining points for unaccepted stories
                                        totalPoints += data[j].data.PlanEstimate;
                                        var scheduleState = data[j].data.ScheduleState;
                                        if (scheduleState !== 'Accepted') {
                                            //only want direct children user stories
                                            if (!(data[j].data.Parent && data[j].data.Parent._ref !== _data[h][i].data._ref)) {
                                                remainingPoints += data[j].data.PlanEstimate;
                                            }
                                        }
                                        else {
                                            acceptedPoints += data[j].data.PlanEstimate;
                                        }
                                        if(preDefinedState) {
                                            if (scheduleState === 'Defined' || scheduleState === 'In-Progress' || scheduleState === 'Completed' || scheduleState === 'Accepted') {
                                                refinedPoints += data[j].data.PlanEstimate;
                                            }
                                        }
                                        else{
                                            if(scheduleState === 'In-Progress' || scheduleState === 'Completed' || scheduleState === 'Accepted') {
                                                refinedPoints += data[j].data.PlanEstimate;
                                            }
                                        }
                                    }
                                }
                                totalTotals += totalPoints;
                                totalRefined += refinedPoints;
                                totalAccepted += acceptedPoints;
                                if (totalPoints !== 0) {
                                    this.refinedPercentage[i] = refinedPoints / totalPoints;
                                } else {
                                    this.refinedPercentage[i] = 0;
                                }
                                this.pointsRemaining[i] = remainingPoints;
                            }
                            var refinedPercent = (totalRefined/totalTotals);
                            var progressPercent = (totalAccepted/totalTotals);
                            if(isNaN(refinedPercent)){
                                refinedPercent = 0;
                            }
                            if(isNaN(progressPercent)){
                                progressPercent = 0;
                            }
                            this.totalRefinedPercent[h]= refinedPercent;
                            this.totalProgressPercent[h]= progressPercent;
                            //build the grid with all necessary data
                            this._onStoreBuilt(_store, _data[h], this.milestonesUsed[h], h, milestoneNumber);
                        }
                    }
                },
                scope: this
            },
            autoLoad: true,
            scope: this
        });
    },
    getColumnCfgs: function(_index){
        var _refined = '%' + Math.round(this.totalRefinedPercent[_index]*100).toString();
        var _progress = '%' + Math.round(this.totalProgressPercent[_index]*100).toString();
        return  [{
            xtype: 'templatecolumn',
            text: 'ID',
            dataIndex: 'FormattedID',
            tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate'),
            flex: 0.5,
            summaryRenderer: function() {
                return "Totals";
            }
        },{
            dataIndex: 'Name',
            text: 'Feature Name',
            flex: 1.5
        },{
            xtype: 'templatecolumn',
            dataIndex: 'PercentDoneByStoryPlanEstimate',
            text: 'Feature Progress',
            tpl: Ext.create('Rally.ui.renderer.template.progressbar.PercentDoneByStoryPlanEstimateTemplate'),
            flex: 0.7,
            summaryRenderer: function() {
                return _progress;
            }
        },{
            xtype: 'templatecolumn',
            dataIndex: 'PointsRemainingRefined',
            text: 'Refined %',
            tpl: this.refinedProgressBar,
            flex: 0.7,
            summaryRenderer: function() {
                return _refined;
            }
        },{
            dataIndex: 'RefinedEstimate',
            text: 'Refined Estimate',
            flex: 1,
            summaryType: 'sum'
        },{
            dataIndex: 'LeafStoryPlanEstimateTotal',
            text: 'Total Leaf Plan Estimate',
            flex: 1,
            summaryType: 'sum'
        }, {
            dataIndex: 'PointsRemaining',
            text: 'Points Remaining',
            flex: 1,
            summaryType: 'sum'
        },{
            dataIndex: 'ProjectName',
            text: 'Project',
            flex: 1.5
        },{
            dataIndex: 'ReleaseName',
            text: 'Release',
            flex: 1.5
        }];
    },
    _onStoreBuilt: function(store, data, title, _i, milestoneNumber) {
        if(title === null){
            title = 'No Milestone';
        }
        var _pointsRemaining = this.pointsRemaining;
        var _refinedPercentage = this.refinedPercentage;
        var recordIndex = -1;
        var records = _.map(data, function(record) {
            recordIndex++;
            return Ext.apply({
                PointsRemaining: _pointsRemaining[recordIndex],
                ReleaseName: record.data.Release ? record.data.Release.Name : '',
                PointsRemainingRefined: _refinedPercentage[recordIndex],
                ProjectName: record.data.Project ? record.data.Project.Name : ''
            }, record.getData());
        });
        var grid = Ext.create('Rally.ui.grid.Grid', {
            xtype: 'rallygrid',
            title: title,
            titleAlign: 'center',
            hideCollapseTool:true,
            collapsible:true,
            collapsed:true,
            editable: false,
            showPagingToolbar: false,
            titleCollapse:true,
            store: Ext.create('Rally.data.custom.Store', {
                data: records,
                pageSize: 100000000000,
                groupField: undefined
            }),
            features: [{ftype:'summary'}],
            columnCfgs: this.getColumnCfgs(_i),
            showRowActionsColumn: false
        });
        this.grids[_i] = grid;
        this.gridsMade++;
        if(this.gridsMade === milestoneNumber) {
            this.addComponents();
        }
    },
    addComponents: function(){
        this.container.add(this.header);
        //cannot use for loop for girds because indexes are non sequential
        var _grids = [];
        this.grids.forEach(function (value) {
            _grids.push(value);
        });
        for(var i = 0; i < _grids.length; i++){
            this.container.add(_grids[i]);
        }
        this.add(this.container);
        this.setLoading(false, false);
    }
});
