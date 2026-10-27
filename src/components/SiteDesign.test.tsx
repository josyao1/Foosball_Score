// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SiteDesign, useDesign } from './SiteDesign';
import { DESIGN_STORAGE_KEY } from '../lib/designs';

afterEach(() => { cleanup(); localStorage.clear(); });
function Probe() {
  const design = useDesign(), location = useLocation();
  return <output>{design.id}/{design.statsLayout} {location.pathname}{location.search}{location.hash}</output>;
}
it('keeps Clay and table statistics despite a saved alternative or old shared URL', () => {
  localStorage.setItem(DESIGN_STORAGE_KEY, 'arcade');
  render(<MemoryRouter initialEntries={['/game/example?filter=live&design=mono#goals']}><SiteDesign/><Probe/></MemoryRouter>);
  expect(screen.getByRole('status').textContent).toBe('clay/table /game/example?filter=live#goals');
  expect(document.documentElement.dataset.design).toBe('clay');
  expect(screen.queryByRole('navigation', { name: 'Design' })).toBeNull();
});
