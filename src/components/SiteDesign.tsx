import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DESIGNS } from '../lib/designs';

const clay = DESIGNS.find(design => design.id === 'clay')!;

// The exploration variants remain in source; the shared app uses the chosen design.
export function useDesign() { return clay; }

export function SiteDesign() {
  const location = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => { document.documentElement.dataset.design = 'clay'; }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('design')) return;
    params.delete('design');
    const search = params.toString();
    void navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true, state: location.state });
  }, [location, navigate]);
  return null;
}
