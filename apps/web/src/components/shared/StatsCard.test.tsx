import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { StatsCard } from './StatsCard';

describe('StatsCard', () => {
  it('renders string values as-is', () => {
    render(<StatsCard title="Status" value="OK" icon={Truck} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('counts numeric values up to the target', async () => {
    render(<StatsCard title="Vehicule" value={42} icon={Truck} />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument(), { timeout: 2000 });
  });

  it('can switch between string and number values without crashing', () => {
    const { rerender } = render(<StatsCard title="T" value="n/a" icon={Truck} />);
    rerender(<StatsCard title="T" value={7} icon={Truck} />);
    rerender(<StatsCard title="T" value="n/a" icon={Truck} />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });
});
