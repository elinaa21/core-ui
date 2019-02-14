//@flow
/* eslint-disable no-param-reassign */

import form from 'form';
import { columnWidthByType } from '../meta';
import { stickybits, transliterator } from 'utils';
import template from '../templates/grid.hbs';
import ListView from './CollectionView';
import RowView from './RowView';
import GridHeaderView from './header/GridHeaderView';
import LoadingChildView from './LoadingRowView';
import ToolbarView from '../../components/toolbar/ToolbarView';
import MobileService from '../../services/MobileService';
import LoadingBehavior from '../../views/behaviors/LoadingBehavior';
import SearchBarView from '../../views/SearchBarView';
import ConfigurationPanel from './ConfigurationPanel';
import EmptyGridView from '../views/EmptyGridView';
import LayoutBehavior from '../../layout/behaviors/LayoutBehavior';

/*
    Public interface:

    This view produce:
        trigger: positionChanged (sender, { oldPosition, position })
        trigger: viewportHeightChanged (sender, { oldViewportHeight, viewportHeight })
    This view react on:
        collection change (via Backbone.Collection events)
        position change (when we scroll with scrollbar for example): updatePosition(newPosition)
 */

const defaultOptions = options => ({
    focusSearchOnAttach: !MobileService.isMobile,
    emptyView: EmptyGridView,
    emptyViewOptions: {
        text: () => (options.columns.length ? Localizer.get('CORE.GRID.EMPTYVIEW.EMPTY') : Localizer.get('CORE.GRID.NOCOLUMNSVIEW.ALLCOLUMNSHIDDEN'))
    },
    stickyToolbarOffset: 0
});

/**
 * @name GridView
 * @memberof module:core.list.views
 * @class GridView
 * @constructor
 * @description View-контейнер для заголовка и контента
 * @extends Marionette.View
 * @param {Object} options Constructor options
 * @param {Array} options.collection массив элементов списка
 * @param {Array} options.columns массив колонок
 * @param {Backbone.View} options.emptyView View для отображения пустого списка (нет строк) или не инициализированы колонки.
 * @param {Number} options.childHeight высота строки списка (childView)
 * @param {Backbone.View} [options.childView] view строки списка
 * @param {Backbone.View} [options.childViewOptions] опции для childView
 * @param {Function} options.childViewSelector ?
 * @param {Object} [options.emptyViewOptions] опции для emptyView
 * @param {String} options.height задает как определяется высота строки, значения: fixed, auto
 * @param {Backbone.View} [options.loadingChildView] view-лоадер, показывается при подгрузке строк
 * @param {Number} options.maxRows максимальное количество отображаемых строк (используется с опцией height: auto)
 * @param {Boolean} options.useDefaultRowView использовать RowView по умолчанию.
 * В случае, если true — обязательно должны быть указаны cellView для каждой колонки
 * */

export default Marionette.View.extend({
    initialize(options) {
        _.defaults(options, defaultOptions(options));
        if (this.collection === undefined) {
            throw new Error('You must provide a collection to display.');
        }

        if (options.columns === undefined) {
            throw new Error('You must provide columns definition ("columns" option)');
        }

        if (typeof options.transliteratedFields === 'object') {
            transliterator.setOptionsToFieldsOfNewSchema(options.columns, options.transliteratedFields);
        }

        options.onColumnSort && (this.onColumnSort = options.onColumnSort); //jshint ignore:line

        this.uniqueId = _.uniqueId('native-grid');
        this.styleSheet = document.createElement('style');

        const HeaderView = this.options.headerView || GridHeaderView;

        if (this.options.showHeader !== false) {
            this.options.showHeader = true;
        }

        if (this.options.showHeader) {
            this.headerView = new HeaderView(
                _.defaultsPure(
                    {
                        columns: options.columns,
                        gridEventAggregator: this,
                        checkBoxPadding: options.checkBoxPadding || 0,
                        uniqueId: this.uniqueId,
                        isTree: this.options.isTree,
                        expandOnShow: options.expandOnShow
                    },
                    this.options
                )
            );

            this.listenTo(this.headerView, 'onColumnSort', this.onColumnSort, this);
            this.listenTo(this.headerView, 'update:width', this.__updateEmptyView);
            this.listenTo(this.headerView, 'set:emptyView:width', this.__updateEmptyView);
        }

        this.isEditable = typeof options.editable === 'boolean' ? options.editable : options.columns.some(column => column.editable);
        if (this.isEditable) {
            this.editableCellsIndexes = [];
            this.options.columns.forEach((column, index) => {
                if (column.editable) {
                    this.editableCellsIndexes.push(index);
                }
            });
            this.listenTo(this.collection, 'move:left', () => this.__onCursorMove(-1));
            this.listenTo(this.collection, 'move:right select:hidden', () => this.__onCursorMove(+1));
            this.listenTo(this.collection, 'select:some select:one', (collection, opts) => this.__onCursorMove(0, opts));
            this.listenTo(this.collection, 'keydown:default', this.__onKeydown);
            this.listenTo(this.collection, 'keydown:escape', e => this.__triggerSelectedModel('selected:exit', e));
        }

        /*
        if (this.options.showCheckbox) {
            const draggable = this.getOption('draggable');
            this.selectionPanelView = new SelectionPanelView({
                collection: this.listView.collection,
                gridEventAggregator: this,
                showRowIndex: this.options.showRowIndex,
                childViewOptions: {
                    draggable,
                    showRowIndex,
                    bindSelection: this.getOption('bindSelection')
                }
            });

            this.selectionHeaderView = new SelectionCellView({
                collection: this.collection,
                selectionType: 'all',
                gridEventAggregator: this,
                showRowIndex
            });

            if (draggable) {
                this.listenTo(this.selectionPanelView, 'childview:drag:drop', (...args) => this.trigger('drag:drop', ...args));
                this.listenTo(this.selectionHeaderView, 'drag:drop', (...args) => this.trigger('drag:drop', ...args));
            }

            if (this.options.showConfigurationPanel) {
                this.__initializeConfigurationPanel();
            }
        }
        */

        this.collection = options.collection;

        if (options.showToolbar) {
            this.toolbarView = new ToolbarView({
                allItemsCollection: options.actions || new Backbone.Collection()
            });
            this.listenTo(this.toolbarView, 'command:execute', this.__executeAction);
        }
        if (options.showSearch) {
            this.searchView = new SearchBarView();
            this.listenTo(this.searchView, 'search', this.__onSearch);
        }
    },

    __onCursorMove(delta, options = {}) {
        const maxIndex = this.editableCellsIndexes.length - 1;
        const currentSelectedIndex = this.editableCellsIndexes.indexOf(this.pointedCell);
        const newPosition = Math.min(maxIndex, Math.max(0, currentSelectedIndex + delta));

        const currentSelectedValue = this.editableCellsIndexes[currentSelectedIndex];
        const newSelectedValue = this.editableCellsIndexes[newPosition];
        const currentModel = this.collection.find(model => model.cid === this.collection.cursorCid);

        if (currentModel) {
            if (newSelectedValue === currentSelectedValue && delta !== 0) {
                const isPositiveDelta = delta >= 1;
                this.pointedCell = isPositiveDelta ? 0 : this.editableCellsIndexes[this.editableCellsIndexes.length - 1];
                this.collection.trigger(isPositiveDelta ? 'nextModel' : 'prevModel');
                return;
            }

            this.pointedCell = newSelectedValue;

            !options.isModelClick && currentModel.trigger('select:pointed', this.pointedCell, false);
        }
    },

    __onKeydown(e) {
        this.__triggerSelectedModel('selected:enter', e);
    },

    __triggerSelectedModel(triggerEvent, ...args) {
        const selectedModel = this.collection.find(model => model.cid === this.collection.cursorCid);
        if (selectedModel) {
            selectedModel.trigger(triggerEvent, ...args);
        }
    },

    onColumnSort(column, comparator) {
        this.collection.comparator = comparator;
        this.collection.sort();
    },

    regions: {
        headerRegion: '.js-grid-header-view',
        contentRegion: {
            el: '.js-grid-content-view',
            replaceElement: true
        },
        toolbarRegion: {
            el: '.js-grid-tools-toolbar-region',
            replaceElement: true
        },
        searchRegion: {
            el: '.js-grid-tools-search-region',
            replaceElement: true
        },
        loadingRegion: '.js-grid-loading-region'
    },

    ui: {
        title: '.js-grid-title',
        tools: '.js-grid-tools',
        header: '.js-grid-header-view',
        content: '.js-grid-content',
        tableWrapper: '.grid-table-wrapper',
        table: '.grid-content-wrp'
    },

    events: {
        dragleave: '__handleDragLeave'
    },

    className() {
        return `${this.options.class || ''} grid-container`;
    },

    template: Handlebars.compile(template),

    behaviors: {
        LoadingBehavior: {
            behaviorClass: LoadingBehavior,
            region: 'loadingRegion'
        },
        LayoutBehavior: {
            behaviorClass: LayoutBehavior
        }
    },

    onRender() {
        if (this.options.showHeader) {
            this.showChildView('headerRegion', this.headerView);
        } else {
            this.el.classList.add('grid__headless');
        }

        if (this.options.showToolbar) {
            this.showChildView('toolbarRegion', this.toolbarView);
        }
        if (this.options.showSearch) {
            this.showChildView('searchRegion', this.searchView);
        }
        if (!(this.options.showToolbar || this.options.showSearch)) {
            this.ui.tools.hide();
        }

        if (this.getOption('title')) {
            this.ui.title.parent().show();
            this.ui.title.text(this.getOption('title') || '');
        } else {
            this.ui.title.parent().hide();
        }
        this.__updateState();
    },

    onAttach() {
        const childView = this.options.childView || RowView;

        const showRowIndex = this.getOption('showRowIndex');

        const childViewOptions = Object.assign(this.options.childViewOptions || {}, {
            columns: this.options.columns,
            transliteratedFields: this.options.transliteratedFields,
            gridEventAggregator: this,
            isTree: this.options.isTree,
            showCheckbox: this.options.showCheckbox,
            draggable: this.options.draggable,
            showRowIndex
        });

        this.listView = new ListView({
            collection: this.collection,
            gridEventAggregator: this,
            childView,
            childViewSelector: this.options.childViewSelector,
            emptyView: this.options.emptyView,
            emptyViewOptions: this.options.emptyViewOptions,
            childHeight: this.options.childHeight,
            childViewOptions,
            loadingChildView: this.options.loadingChildView || LoadingChildView,
            maxRows: this.options.maxRows,
            height: this.options.height,
            isTree: this.options.isTree,
            isEditable: this.isEditable,
            showRowIndex,
            parentEl: this.ui.tableWrapper[0],
            parent$el: this.ui.tableWrapper,
            table$el: this.ui.table,
            minimumVisibleRows: this.options.minimumVisibleRows
        });
        this.listenTo(this.listView, 'all', (eventName, eventArguments) => {
            if (eventName.startsWith('childview')) {
                this.trigger.apply(this, [eventName].concat(eventArguments));
            }
            if (eventName === 'empty:view:destroyed') {
                this.__resetViewStyle();
            }
        });
        this.updatePosition = this.listView.updatePosition.bind(this.listView.collectionView);

        this.showChildView('contentRegion', this.listView);

        this.__updateEmptyView();

        if (this.options.showSearch && this.options.focusSearchOnAttach) {
            this.searchView.focus();
        }
        const toolbarShowed = this.options.showToolbar || this.options.showSearch;

        this.stickyHeaderInstance = stickybits(this.el.querySelector('.grid-header-view'), {
            stickyBitStickyOffset: toolbarShowed ? 0 : this.options.stickyToolbarOffset,
            scrollEl: this.options.scrollEl,
            customStickyChangeNumber: this.options.customStickyChangeNumber,
            stateChangeCb: currentState => {
                //hack for IE11
                switch (currentState) {
                    case 'sticky': {
                        // fixed header fall of layout
                        this.ui.content[0].style.marginTop = '35px'; // header height + default margin
                        break;
                    }
                    default:
                        // static header
                        this.ui.content[0].style.marginTop = ''; // default margin
                        break;
                }
            }
        });
        if (toolbarShowed) {
            this.stickyToolbarInstance = stickybits(this.el.querySelector('.js-grid-tools'), { scrollEl: this.options.scrollEl });
        }
        //hack for IE11
        if (Core.services.MobileService.isIE) {
            this.on('update:height', () => {
                this.stickyHeaderInstance.update();
                if (toolbarShowed) {
                    this.stickyToolbarInstance.update();
                }
            });
        }
    },

    getChildren() {
        return this.listView.children;
    },

    update() {
        this.__updateState();
    },

    __executeAction(...args) {
        this.trigger('execute:action', ...args);
    },

    __onSearch(text) {
        this.trigger('search', text);
        if (this.options.isTree) {
            this.trigger('toggle:collapse:all', !text && !this.options.expandOnShow);
        }
    },

    onDestroy() {
        this.styleSheet && document.body && document.body.contains(this.styleSheet) && document.body.removeChild(this.styleSheet);
        this.__configurationPanel && this.__configurationPanel.destroy();
    },

    sortBy(columnIndex, sorting) {
        const column = this.options.columns[columnIndex];
        if (sorting) {
            this.options.columns.forEach(c => (c.sorting = null));
            column.sorting = sorting;

            switch (sorting) {
                case 'asc':
                    this.collection.comparator = column.sortAsc;
                    break;
                case 'desc':
                    this.collection.comparator = column.sortDesc;
                    break;
                default:
                    break;
            }
        } else {
            sorting = column.sorting;
            this.options.columns.forEach(c => (c.sorting = null));

            switch (sorting) {
                case 'asc':
                    column.sorting = 'desc';
                    this.collection.comparator = column.sortDesc;
                    break;
                case 'desc':
                    column.sorting = 'asc';
                    this.collection.comparator = column.sortAsc;
                    break;
                default:
                    column.sorting = 'asc';
                    this.collection.comparator = column.sortAsc;
                    break;
            }
        }
        this.onColumnSort(column, this.collection.comparator);
        if (this.options.showHeader) {
            this.headerView.updateSorting();
        }
    },

    handleResize() {
        if (this.options.showHeader) {
            this.headerView.handleResize();
        }
    },

    setLoading(state) {
        if (!this.isDestroyed()) {
            this.loading.setLoading(state);
        }
    },

    validate() {
        if (!this.isEditable) {
            return;
        }

        return this.options.columns.some(column => {
            if (!column.editable || !column.validators) {
                return false;
            }
            const validators = [];
            return column.validators.some(validator => {
                let result;
                if (typeof validator === 'function') {
                    validators.push(validator);
                } else {
                    const predefined = form.repository.validators[validator];
                    if (typeof predefined === 'function') {
                        validators.push(predefined());
                    }
                }

                this.collection.forEach(model => {
                    if (model._events['validate:force']) {
                        const e = {};
                        model.trigger('validate:force', e);
                        if (e.validationResult) {
                            result = e.validationResult;
                        }
                    } else if (!model.isValid()) {
                        result = model.validationResult;
                    } else {
                        validators.some(v => {
                            const error = v(model.get(column.key), model.attributes);
                            if (error) {
                                result = model.validationResult = error;
                            }
                            return result;
                        });
                    }
                });
                return result;
            });
        });
    },

    __handleDragLeave(e) {
        if (!this.el.contains(e.relatedTarget)) {
            if (this.collection.dragoverModel) {
                this.collection.dragoverModel.trigger('dragleave');
            } else {
                this.collection.trigger('dragleave:head');
            }
            this.collection.dragoverModel = null;
        }
    },

    __updateEmptyView(allColumnsWidth) {
        if (!this.options.emptyView) {
            return;
        }
        if (this.listView.isEmpty()) {
            this.emptyViewClass = this.emptyViewClass || (() => `.${new this.options.emptyView().className}`)();
            const empty$el = this.listView.$el.find(this.emptyViewClass);

            if (allColumnsWidth && empty$el) {
                empty$el && empty$el.width(allColumnsWidth);
            }

            this.ui.content.css({
                'min-height': `${this.listView.childHeight}px`,
                height: '100%'
            });
        }
    },

    __initializeConfigurationPanel() {
        this.__configurationPanel = new ConfigurationPanel();
    },

    __resetViewStyle() {
        this.ui.content.css({
            'min-height': '',
            height: ''
        });
    }
});
