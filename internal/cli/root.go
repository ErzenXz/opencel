package cli

import (
	"github.com/spf13/cobra"
)

func NewRoot() *cobra.Command {
	root := &cobra.Command{
		Use:   "opencel",
		Short: "OpenCel CLI",
	}

	root.AddCommand(newMigrateCmd())
	root.AddCommand(newDoctorCmd())
	root.AddCommand(newInstallCmd())
	root.AddCommand(newUpdateCmd())

	return root
}
