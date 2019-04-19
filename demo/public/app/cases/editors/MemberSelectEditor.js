import CanvasView from 'demoPage/views/CanvasView';

export default function() {
    const model = new Backbone.Model({
        selected: ['user.1']
    });

    return new CanvasView({
        view: new Core.form.editors.MembersSplitEditor({
            model,
            key: 'selected',
            autocommit: true,
            // hideUsers: true,
            filterFnParameters: {
                users: 'users',
                groups: 'groups',
                all: 'all'
            },
            memberTypes: {
                users: 'users',
                groups: 'groups'
            },
            users: Core.services.UserService.listUsers(),
            groups: Core.services.UserService.listGroups(),
            showMode: 'button'
        }),
        presentation: "'{{selected}}'",
        isEditor: true
    });
}
