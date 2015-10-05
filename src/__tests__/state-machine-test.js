import expect from "expect.js";
import {Observable} from "rx-lite";
import constant from "lodash/utility/constant";
import {createApp, bindActionCreators, setState, chainActions} from "../";


let getState, subscribe, update, unsubscribe, history;

beforeEach(() => {
    const app = createApp();
    getState = app.getState;
    subscribe = app.subscribe;
    update = app.update;
    history = [];
    unsubscribe = subscribe(state => history.push(state));
});


describe("getState", () => {

    it("provides a snapshot of current state", () => {
        expect(getState()).to.eql(undefined);
    });

});


describe("subscribe", () => {

    it("provides subscribers with initial state", () => {
        expect(history).to.eql([undefined]);
    });

    it("notifies listeners of new state", () => {
        update(constant("bar"));
        expect(history).to.eql([undefined, "bar"]);
    });

    it("returns an unsubscribe function", () => {
        unsubscribe();
        update(constant("bar"));
        expect(history).to.eql([undefined]);
    });

});


describe("iteratorMiddleware", () => {

    it("resolves iterators", () => {
        update(chainActions(constant("foo"), constant("bar")));
        expect(history).to.eql([undefined, "foo", "bar"]);
    });

});


describe("promiseMiddleware", () => {

    it("resolves promises", async () => {
        const promise = Promise.resolve(constant("foo"));
        update(promise);
        await promise;
        expect(history).to.eql([undefined, "foo"]);
    });

});


describe("observableMiddleware", () => {

    it("resolves observables", async () => {
        const observable = Observable.of(constant("foo"), constant("bar"));
        update(observable);
        await observable.toPromise();
        expect(history).to.eql([undefined, "foo", "bar"]);
    });

});


describe("setState", () => {

    it("allows state to be merged with existing state", () => {
        update(setState({foo: "FOO"}));
        update(setState({bar: "BAR"}));
        expect(history).to.eql([undefined, {foo: "FOO"}, {foo: "FOO", bar: "BAR"}]);
    });

    it("overrides existing keys", () => {
        update(setState({foo: "FOO"}));
        update(setState({foo: "BAR"}));
        expect(history).to.eql([undefined, {foo: "FOO"}, {foo: "BAR"}]);
    });

    it("allows keys to be merged with existing values", () => {
        update(setState({foo: "FOO"}));
        update(setState({foo: f => f + "2"}));
        expect(history).to.eql([undefined, {foo: "FOO"}, {foo: "FOO2"}]);
    });

});


describe("bound action creators", () => {

    let actions;
    beforeEach(() => {
        actions = bindActionCreators({
            setFoo: v => setState({foo: v})
        }, update);
    });

    it("runs the update function with the resolved action", () => {
        actions.setFoo("FOO");
        expect(history).to.eql([undefined, {foo: "FOO"}]);
    });

});


describe("nested bound action creators", () => {

    let actions;
    beforeEach(() => {
        actions = bindActionCreators({
            nested: {
                default: () => setState({foo: "FOO"}),
                setFoo: v => setState({foo: v}),
                setFooPromise: async v => setState({foo: v})
            }
        }, update);
    });

    it("sets default state", () => {
        expect(history).to.eql([undefined, {nested: {foo: "FOO"}}]);
    });

    it("applies nested actions", () => {
        actions.nested.setFoo("FOO2");
        expect(history).to.eql([undefined, {nested: {foo: "FOO"}}, {nested: {foo: "FOO2"}}]);
    });

    it("resolves nested actions", async () => {
        await actions.nested.setFooPromise("FOO2");
        expect(history).to.eql([undefined, {nested: {foo: "FOO"}}, {nested: {foo: "FOO2"}}]);
    });

});
