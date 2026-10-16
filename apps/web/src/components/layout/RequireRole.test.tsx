import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireRole from './RequireRole';
import { useAuthStore } from '@/stores/auth.store';

type Role = 'SUPER_ADMIN' | 'COUNTRY_MANAGER' | 'AGENCY_MANAGER';

function setRole(role: Role | null) {
  useAuthStore.setState({
    user: role
      ? { id: '1', email: 'a@b.ro', firstName: 'A', lastName: 'B', role, agencyId: null }
      : null,
    isAuthenticated: !!role,
    isLoading: false,
  });
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route
          path="/admin"
          element={<RequireRole roles={['SUPER_ADMIN']}><p>secret</p></RequireRole>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  beforeEach(() => setRole(null));

  it('renders children for an allowed role', () => {
    setRole('SUPER_ADMIN');
    renderGuarded();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it.each<Role | null>(['AGENCY_MANAGER', 'COUNTRY_MANAGER', null])(
    'redirects %s to the dashboard',
    (role) => {
      setRole(role);
      renderGuarded();
      expect(screen.queryByText('secret')).not.toBeInTheDocument();
      expect(screen.getByText('dashboard')).toBeInTheDocument();
    },
  );
});
