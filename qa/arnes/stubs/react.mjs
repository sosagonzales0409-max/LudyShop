export class Component { constructor(props) { this.props = props; } }
export const createContext = () => ({ Provider: 'Provider' });
const React = { createElement: () => null, Component, createContext };
export default React;
