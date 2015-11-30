/**
 * Developer: Grigory Kuznetsov
 * Date: 17.08.2015
 * Copyright: 2009-2015 Comindware®
 *       All Rights Reserved
 *
 * THIS IS UNPUBLISHED PROPRIETARY SOURCE CODE OF Comindware
 *       The copyright notice above does not evidence any
 *       actual or intended publication of such source code.
 */

/* global define, require, Marionette, Handlebars */

define(['text!../templates/columnHeader.html', 'module/lib', '../../list/views/GridColumnHeaderView'],
    function (template, lib, GridColumnHeaderView) {
        'use strict';

        /**
         * Some description for initializer
         * @name ColumnHeaderView
         * @memberof module:core.nativeGrid.views
         * @class ColumnHeaderView
         * @constructor
         * @description View для отображения ячейки заголовка (шапки) списка
         * @extends module:core.list.views.GridColumnHeaderView {@link module:core.list.views.GridColumnHeaderView}
         * @param {Object} options Constructor options
         * @param {Array} options.columns Массив колонок
         * @param {} options.gridEventAggregator ?
         * */
        var ColumnHeaderView = GridColumnHeaderView.extend({
            initialize: function (options) {
                GridColumnHeaderView.prototype.initialize.apply(this, arguments);

                if (this.column.filterView) {
                    this.filterView = this.column.filterView;
                    this.listenTo(this.model, 'change:hasFilter', this.__resolveFilterClass, this);
                }
                this.gridEventAggregator = options.gridEventAggregator;
            },

            template: Handlebars.compile(template),

            ui: {
                cellContent: '.js-cell-content',
                filterBtn: '.js-filter-btn'
            },

            events: {
                'click @ui.cellContent': '__handleSorting',
                'click @ui.filterBtn': 'showFilterPopout'
            },

            __resolveFilterClass: function () {
                if (!this.column.filterView) {
                    return;
                }

                var hasFilter = this.model.get('hasFilter');

                if (hasFilter) {
                    this.$el.addClass('has-filter');
                } else {
                    this.$el.removeClass('has-filter');
                }
            },

            showFilterPopout: function (event) {
                event.preventDefault();
                event.stopPropagation();
                this.gridEventAggregator.trigger('showFilterView', {
                    columnHeader: this,
                    filterView: this.filterView,
                    position: $(event.currentTarget).offset()
                });
            },

            templateHelpers: function () {
                return {
                    sortingAsc: this.column.sorting === 'asc',
                    sortingDesc: this.column.sorting === 'desc',
                    filterView: this.filterView !== undefined
                };
            },

            onRender: function () {
                this.__resolveFilterClass();
            }
        });

        return ColumnHeaderView;
    });
