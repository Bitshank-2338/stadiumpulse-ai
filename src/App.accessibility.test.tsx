import { act, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { App } from './App';

vi.mock('./components/stadium-canvas', () => ({
  StadiumCanvas: () => (
    <div role="img" aria-label="Interactive 3D stadium textual test substitute" />
  ),
}));

const VIEW_NAMES = [
  'Digital Twin',
  'Fan Companion',
  'Accessibility',
  'Volunteer',
  'Operations',
  'Scenario Lab',
] as const;

describe('App accessibility', () => {
  it('has no automatically detectable axe violations in every primary view', async () => {
    const { container } = render(<App />);

    for (const view of VIEW_NAMES) {
      fireEvent.click(screen.getByRole('button', { name: view }));
      await act(async () => {
        const result = await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        });
        expect(result.violations, `${view}: ${result.violations.map((v) => v.id).join(', ')}`).toEqual([]);
      });
    }
  }, 30_000);

  it('moves focus to the active view heading', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }));
    expect(screen.getByRole('heading', { name: 'Operations Command Center' })).toHaveFocus();
  });

  it('exposes one main landmark and communicates layer toggle state', () => {
    render(<App />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const crowd = screen.getByRole('button', { name: 'Crowd ●' });
    expect(crowd).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(crowd);
    expect(screen.getByRole('button', { name: 'Crowd ○' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('associates empty Fan Companion and Volunteer errors with their inputs', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Get guidance' }));
    const fanInput = screen.getByRole('textbox', { name: 'Ask for anything' });
    expect(fanInput).toHaveAttribute('aria-invalid', 'true');
    expect(fanInput).toHaveAccessibleDescription('Please describe where you want to go...');

    fireEvent.click(screen.getByRole('button', { name: 'Volunteer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze report' }));
    const volunteerInput = screen.getByRole('textbox', { name: 'What is happening?' });
    expect(volunteerInput).toHaveAttribute('aria-invalid', 'true');
    expect(volunteerInput).toHaveAccessibleDescription(
      'Please describe what is happening before analyzing the report.',
    );
  });
});
