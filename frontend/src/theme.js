import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#37352F', // Notion text color as primary
            light: '#5A5A55',
            dark: '#201F1B',
        },
        secondary: {
            main: '#EB5757', // Notion red
            light: '#FDECEC', // Light red background
        },
        background: {
            default: '#FFFFFF',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#37352F',
            secondary: '#73726E',
        },
        divider: '#EAEAEA',
        action: {
            hover: '#F1F1EF', // Notion hover color
            selected: '#EFEFED',
        }
    },
    typography: {
        fontFamily: '"Geomini", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
        button: {
            textTransform: 'none',
            fontWeight: 500,
        },
        h1: { fontWeight: 700, color: '#37352F' },
        h2: { fontWeight: 600, color: '#37352F' },
        h3: { fontWeight: 600, color: '#37352F' },
        h4: { fontWeight: 600, color: '#37352F' },
        h5: { fontWeight: 600, color: '#37352F' },
        h6: { fontWeight: 600, color: '#37352F' },
    },
    shape: {
        borderRadius: 4, // More squared like Notion
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    boxShadow: 'none',
                    padding: '6px 12px',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                },
                contained: {
                    backgroundColor: '#37352F',
                    color: '#FFFFFF',
                    '&:hover': {
                        backgroundColor: '#201F1B',
                    }
                },
                outlined: {
                    borderColor: '#EAEAEA',
                    color: '#37352F',
                    '&:hover': {
                        backgroundColor: '#F1F1EF',
                        borderColor: '#EAEAEA',
                    }
                },
                text: {
                    color: '#37352F',
                    '&:hover': {
                        backgroundColor: '#F1F1EF',
                    }
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    border: '1px solid #EAEAEA',
                    boxShadow: 'none',
                    transition: 'background-color 0.2s',
                    '&:hover': {
                        backgroundColor: '#F9F9F8',
                    }
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#F7F7F5',
                    borderRight: '1px solid #EAEAEA',
                }
            }
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    boxShadow: 'rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgb(15 15 15 / 10%) 0px 3px 6px, rgb(15 15 15 / 20%) 0px 9px 24px',
                    borderRadius: 6,
                }
            }
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontSize: '0.875rem',
                    padding: '6px 12px',
                    '&:hover': {
                        backgroundColor: '#F1F1EF',
                    }
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    '&:hover': {
                        backgroundColor: '#F1F1EF',
                    },
                    '&.Mui-selected': {
                        backgroundColor: '#EFEFED',
                        '&:hover': {
                            backgroundColor: '#E6E6E4',
                        }
                    }
                }
            }
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#EAEAEA',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#CCCCCC',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#37352F',
                        borderWidth: 1,
                    },
                }
            }
        }
    },
});

export default theme;
