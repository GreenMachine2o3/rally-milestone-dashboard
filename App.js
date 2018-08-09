Ext.define('CustomApp', {
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
        this._loadReleases();
    },
    _loadReleases: function(){
        var milestoneStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'Milestone',
                limit: Infinity,
                autoLoad:true,
                context: {
                    projectScopeUp: false
                },
                listeners: {
                    load: function(store, data, success) {
                        this.milestoneNumber = data.length-1;
                        this.milestonesRemaining = data.length+1;
                        for(var i = 0; i < data.length; i++){
                            if(this.milestones.length === 0){
                                this.milestones.push(data[i].data.Name);
                            }
                            else {
                                for (var j = 0; j < this.milestones.length; j++) {
                                    if(this.milestones[j] === data[i].data.Name){
                                        break;
                                    }
                                    if(j === this.milestones.length-1){
                                        this.milestones.push(data[i].data.Name);
                                    }
                                }
                            }
                        }
                        this.milestonesRemaining = this.milestones.length;
                        this.getFeatures();
                    },
                    scope:this
                }
        });
    },
    _finalStore: function(){
        this.getFeatures(null, "No Milestone", 'Final');
    },
    getFeatures: function(){
        var mystore = Ext.create('Rally.data.wsapi.Store', {
            model: 'portfolioitem/feature',
            context: {
                projectScopeUp: false
            },
            listeners: {
                load: function(store, data, success) {
                    var milestonesFound = 0;
                    for(var i = 0; i < data.length; i++){
                        if(data[i].data.Milestones.Count === 0){
                            if (this.featuresByMilestone[1000000]) {
                                this.featuresByMilestone[1000000].push(data[i]);
                            }
                            else {
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
                                        else {
                                            milestonesFound++;
                                            this.featuresByMilestone[k] = [data[i]];
                                        }
                                    }
                                }
                            }
                        }
                    }
                    var that = this;
                    this.featuresByMilestone.forEach(function (value, index) {
                        if(that.milestones[index]) {
                            that.getUserStoryData(store, that.featuresByMilestone[index], that.milestones[index], index, milestonesFound);
                        }
                        else{
                            that.getUserStoryData(store, that.featuresByMilestone[index], null, index, milestonesFound);
                        }
                    });
                },
                scope: this
            },
            autoLoad: true,
            fetch: ['FormattedID', 'Name', 'PercentDoneByStoryPlanEstimate', 'RefinedEstimate', 'LeafStoryPlanEstimateTotal', 'Project', 'Release', 'Milestones']
        });
    },
    getUserStoryData: function(_store, _data, milestoneName, _i, milestoneNumber){
        this.pointsRemaining = [];
        //filter for features in this milestone
            var myFilters = Ext.create('Rally.data.QueryFilter', {
                    property: 'Feature.Milestones.Name',
                    operation: 'contains',
                    value: milestoneName
            });
            var userStoryStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'User Story',
                filters: myFilters,
                limit: Infinity,
                context: {
                    workspace: this.getContext().getWorkspaceRef(),
                    project: null
                },
                fetch: ['Feature', 'PlanEstimate', 'ScheduleState', 'Parent'],
                listeners: {
                    load: function (store, data, success) {
                        var totalTotals = 0;
                        var totalRefined = 0;
                        var totalAccepted = 0;
                        if (data) {
                            for (var i = 0; i < _data.length; i++) {
                                var remainingPoints = 0;
                                var totalPoints = 0;
                                var refinedPoints = 0;
                                var acceptedPoints = 0;
                                for (var j = 0; j < data.length; j++) {
                                    if (data[j].data.Feature != null && data[j].data.Feature._ref === _data[i].data._ref) {
                                        //only want remaining points for unaccepted stories
                                        totalPoints += data[j].data.PlanEstimate;
                                        var scheduleState = data[j].data.ScheduleState;
                                        if (scheduleState !== 'Accepted') {
                                            if(!(data[j].data.Parent && data[j].data.Parent._ref !== _data[i].data._ref)) {
                                                remainingPoints += data[j].data.PlanEstimate;
                                            }
                                        }
                                        else{
                                            acceptedPoints += data[j].data.PlanEstimate;
                                        }
                                        if(scheduleState === 'Defined' || scheduleState === 'In-Progress'
                                        || scheduleState === 'Completed' || scheduleState === 'Accepted'){
                                            refinedPoints += data[j].data.PlanEstimate;
                                        }
                                    }
                                }
                                totalTotals += totalPoints;
                                totalRefined += refinedPoints;
                                totalAccepted += acceptedPoints;
                                if(totalPoints !== 0) {
                                    this.refinedPercentage[i] = refinedPoints/totalPoints;
                                }else{
                                    this.refinedPercentage[i] = 0;
                                }
                                this.pointsRemaining[i] = remainingPoints;
                            }
                            this.totalRefinedPercent[_i]=(totalRefined / totalTotals);
                            this.totalProgressPercent[_i]=(totalAccepted / totalTotals);
                        }
                        if(milestoneName === null){
                            milestoneName = 'No Milestone';
                        }
                        //build the grid with all necessary data
                        this._onStoreBuilt(_store, _data, milestoneName, _i, milestoneNumber);
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
            flex: .5,
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
            flex:.7,
            summaryRenderer: function() {
                return _progress;
            }
        },{
            xtype: 'templatecolumn',
            dataIndex: 'PointsRemainingRefined',
            text: 'Refined %',
            tpl: this.refinedProgressBar,
            flex: .7,
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
