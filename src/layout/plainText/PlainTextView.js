import LayoutBehavior from '../behaviors/LayoutBehavior';

export default Marionette.View.extend({
    initialize(options) {
        this.text = options.text;
        this.key = options.key;
        if (this.model && this.key) {
            this.listenTo(this.model, `change:${this.key}`, (model, newValue) => this.$el.text(newValue));
        }
    },

    template: false,

    behaviors: {
        LayoutBehavior: {
            behaviorClass: LayoutBehavior
        }
    },

    onRender() {
        if (this.model && this.key) {
            this.$el.text(this.model.get(this.key));
        } else {
            this.$el.text(this.text);
        }
    },

    update() {
        this.__updateState();
    }
});
