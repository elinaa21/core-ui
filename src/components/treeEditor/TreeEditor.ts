import TEButtonView from './views/TEButtonView';
import NodeViewFactory from './services/NodeViewFactory';

const defaultOptions = {
    eyeIconClass: 'eye',
    closedEyeIconClass: 'eye-slash',
    configDiff: {},
    getNodeName: undefined
};

interface TConfigDiff {
    [key: string]: {
        index?: number,
        isHidden?: boolean
    };
}

export default class TreeVEditor {
    configDiff: TConfigDiff;
    model: any;
    constructor(options: { model: any, eyeIconClass?: string, closedEyeIconClass: string, configDiff: TConfigDiff, unNamedType?: string, getNodeName?: (model: any) => string }) {
        _.defaults(options, defaultOptions);
        this.configDiff = options.configDiff;
        this.model = options.model;

        const reqres = Backbone.Radio.channel(_.uniqueId('treeEditor'));

        const popoutView = Core.dropdown.factory.createPopout({
            buttonView: TEButtonView,
            buttonViewOptions: {
                iconClass: options.eyeIconClass
            },

            panelView: NodeViewFactory.getNodeView(this.model, options.unNamedType),
            panelViewOptions: Object.assign({}, options, {
                reqres,
                maxWidth: 300
            })
        });

        reqres.reply('personalFormConfiguration:setWidgetConfig', (id, config) => this.applyConfigDiff(id, config));
        popoutView.listenTo(popoutView, 'close', () => popoutView.trigger('save', this.configDiff));

        return popoutView;
    }

    applyConfigDiff(id: string, config: TConfigDiff) {
        if (this.configDiff[id]) {
            Object.assign(this.configDiff[id], config);
        } else {
            this.configDiff[id] = config;
        }
    }
}
