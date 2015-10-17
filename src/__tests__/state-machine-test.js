import expect from "expect.js";
import {createStore, bindActionCreators, setState, createAsyncAction, reduceActions, reduceActionCreators} from "../";


describe("state-machine", () => {

    const actionCreators = reduceActionCreators({
        initialize: () => setState({
            foo: "foo"
        }),
        bar: {
            initialize: () => setState({
                baz: "baz"
            }),
            setBaz: baz => setState({baz}),
            setBazReduced: baz => setState({baz: undefined})
        }
    }, {
        bar: {
            setBazReduced: baz => setState({baz}),
            setBazAsync: baz => createAsyncAction((dispatch, getState) => {
                expect(getState()).to.eql({baz: "baz"});
                dispatch(setState({baz}));
            })
        }
    });

    const initialState = {
        foo: "foo",
        bar: {
            baz: "baz"
        }
    };

    const stateWithFoo = {
        foo: "FOO",
        bar: {
            baz: "baz"
        }
    };

    const stateWithBaz = {
        foo: "foo",
        bar: {
            baz: "BAZ"
        }
    };

    let getState, subscribe, dispatch, actions, history, unsubscribe;

    beforeEach(() => {
        const store = createStore();
        getState = store.getState;
        subscribe = store.subscribe;
        dispatch = store.dispatch;
        actions = bindActionCreators(actionCreators, dispatch);
        history = [];
        unsubscribe = subscribe(state => history.push(state));
    });


    describe("getState", () => {

        it("provides a snapshot of current state", () => {
            expect(getState()).to.eql(initialState);
        });

    });


    describe("subscribe", () => {

        it("provides subscribers with initial state", () => {
            expect(history).to.eql([initialState]);
        });

        it("notifies listeners of new state", () => {
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("does not notify listeners of identical state", () => {
            dispatch(state => state);
            expect(history).to.eql([initialState]);
        });

        it("returns an unsubscribe function", () => {
            unsubscribe();
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([initialState]);
        });

    });


    describe("setState", () => {

        it("allows state to be merged with existing state", () => {
            dispatch(setState({foo: "FOO"}));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("allows keys to be merged with existing values", () => {
            dispatch(setState({foo: f => f.toUpperCase()}));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

    });


    describe("reduced action", () => {

        it("runs multiple actions in the order declared", () => {
            dispatch(reduceActions(
                setState({foo: undefined}),
                setState({foo: undefined}),
                setState({foo: "FOO"})
            ));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

    });


    describe("async action", () => {

        it("provides a dispatch function", () => {
            dispatch(createAsyncAction(dispatch => dispatch(setState({foo: "FOO"}))));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

        it("provides a getState function", () => {
            dispatch(createAsyncAction((dispatch, getState) => {
                expect(getState()).to.eql(initialState);
            }));
        });

        it("debounces multiple synchronous calls to dispatch", () => {
            dispatch(createAsyncAction(dispatch => {
                dispatch(setState({foo: "bar"}));
                dispatch(setState({foo: "FOO"}));
            }));
            expect(history).to.eql([initialState, stateWithFoo]);
        });

    });


    describe("nested action", () => {

        it("runs the dispatch function with the resolved action", () => {
            actions.bar.setBaz("BAZ");
            expect(history).to.eql([initialState, stateWithBaz]);
        });

        it("runs async actions", () => {
            actions.bar.setBazAsync("BAZ");
            expect(history).to.eql([initialState, stateWithBaz]);
        });

    });


    describe("reduceActionCreators", () => {

        it("runs reduced action creators in the order declared", () => {
            actions.bar.setBazReduced("BAZ");
            expect(history).to.eql([initialState, stateWithBaz]);
        });

    });


});
