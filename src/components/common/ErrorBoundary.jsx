/**
 * ErrorBoundary — keeps one broken panel from blanking the whole app.
 * Shows what failed and a button to try rendering the panel again.
 */
import React from 'react';
import { Alert, Box, Button } from '@mui/material';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.name || 'panel'}]`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => this.setState({ error: null })}>Try again</Button>}
        >
          {this.props.name ? `The ${this.props.name} stopped working. ` : 'Something stopped working. '}
          Your library is safe. {String(this.state.error?.message || '')}
        </Alert>
      </Box>
    );
  }
}
