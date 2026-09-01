// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useState, type ReactNode } from 'react';
import { createSequence } from './sequence';

const { SequenceProvider, useSequence } = createSequence('Test');

/** A container of the shape a pack's container island has: it owns the position. */
function Harness({ positions }: { positions: string[] }) {
  const [current, setCurrent] = useState('');
  return (
    <SequenceProvider positions={positions} current={current} onGo={setCurrent}>
      <Probe />
    </SequenceProvider>
  );
}

function Probe() {
  const sequence = useSequence();
  if (!sequence) return <p id="outside">outside</p>;
  return (
    <div>
      <output id="current">{sequence.current || '(start)'}</output>
      <output id="index">{sequence.index}</output>
      <button id="next" type="button" onClick={() => sequence.step(1)} />
      <button id="back" type="button" onClick={() => sequence.step(-1)} />
      <button id="jump" type="button" onClick={() => sequence.go('c')} />
    </div>
  );
}

let host: HTMLDivElement;
let root: Root;

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function click(id: string) {
  act(() => {
    host.querySelector<HTMLButtonElement>(`#${id}`)?.click();
  });
}

const text = (id: string) => host.querySelector(`#${id}`)?.textContent;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('createSequence', () => {
  it('starts before the first position, which is a real place', () => {
    mount(<Harness positions={['a', 'b', 'c']} />);

    expect(text('current')).toBe('(start)');
    expect(text('index')).toBe('-1');
  });

  it('steps forward and back along the line', () => {
    mount(<Harness positions={['a', 'b', 'c']} />);

    click('next');
    expect(text('current')).toBe('a');

    click('next');
    expect(text('current')).toBe('b');
    expect(text('index')).toBe('1');

    click('back');
    expect(text('current')).toBe('a');
  });

  it('clamps at the end rather than falling off it', () => {
    mount(<Harness positions={['a', 'b']} />);

    click('next');
    click('next');
    click('next');

    expect(text('current')).toBe('b');
  });

  it('clamps at the start, back to the position before the first', () => {
    mount(<Harness positions={['a', 'b']} />);

    click('next');
    click('back');
    click('back');

    expect(text('current')).toBe('(start)');
    expect(text('index')).toBe('-1');
  });

  it('is bidirectional: a child can write the position, not only read it', () => {
    mount(<Harness positions={['a', 'b', 'c']} />);

    click('jump');

    expect(text('current')).toBe('c');
    expect(text('index')).toBe('2');
  });

  it('is undefined outside a provider, so an island can say so instead of crashing', () => {
    mount(<Probe />);
    expect(text('outside')).toBe('outside');
  });
});
