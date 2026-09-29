package api

import (
	"encoding/json"
	"net/http"
)

type healthResponse struct {
	Status string `json:"status"`
}

// handleHealth reports that the process is up. It deliberately checks nothing else:
// a liveness probe that fails because a dependency is briefly unreachable takes the
// service down instead of reporting on it.
func handleHealth() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(healthResponse{Status: "ok"}); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})
}
