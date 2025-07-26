import React, { useState } from 'react';
import { CssBaseline, Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, Fab, Snackbar, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import InfoIcon from '@mui/icons-material/Info';
import ListIcon from '@mui/icons-material/List';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import MapView from './components/MapView';

const drawerWidth = 300;

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('incidents');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDrawerToggle = () => setDrawerOpen(!drawerOpen);
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: 1300 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            911Mapr Rochester
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List>
          <ListItem button selected={activeTab === 'about'} onClick={() => handleTabChange('about')}>
            <ListItemIcon><InfoIcon /></ListItemIcon>
            <ListItemText primary="About" />
          </ListItem>
          <ListItem button selected={activeTab === 'incidents'} onClick={() => handleTabChange('incidents')}>
            <ListItemIcon><ListIcon /></ListItemIcon>
            <ListItemText primary="Live Incidents" />
          </ListItem>
          <ListItem button selected={activeTab === 'settings'} onClick={() => handleTabChange('settings')}>
            <ListItemIcon><SettingsIcon /></ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItem>
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, height: '100vh', position: 'relative' }}>
        <Toolbar />
        {/* Main content area */}
        {activeTab === 'about' && (
          <Box sx={{ p: 3, maxWidth: 600 }}>
            <Typography variant="h5" gutterBottom>About 911Mapr</Typography>
            <Typography variant="body1" gutterBottom>
              911Mapr is a Live Map of 911 Incidents Across Monroe County, NY (Rochester).<br />
              Data Sourced from <a href="https://www.monroecounty.gov/safety-incidents" target="_blank" rel="noopener noreferrer">Monroe County Dispatch</a>.
            </Typography>
            <Typography variant="body2" color="warning.main" gutterBottom>
              Disclaimer: Not affiliated with any government entity. Data accuracy is not guaranteed. Use at your own risk.
            </Typography>
          </Box>
        )}
        {activeTab === 'incidents' && (
          <Box sx={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}>
            <MapView showIncidentListPanel />
          </Box>
        )}
        {activeTab === 'settings' && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>Settings</Typography>
            <Button variant="outlined" onClick={() => setSnackbarOpen(true)}>Add Test Incident</Button>
          </Box>
        )}
        <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1200 }} onClick={() => setDialogOpen(true)}>
          <AddIcon />
        </Fab>
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          message="Test incident added!"
        />
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>Support 911Mapr</DialogTitle>
          <DialogContent>
            <DialogContentText>
              If you find this project useful, consider supporting the developer!
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Close</Button>
            <Button href="https://ko-fi.com/dupras" target="_blank" rel="noopener noreferrer">Ko-fi</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

export default App;
