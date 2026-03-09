package utils

import (
	"errors"
	"time"
)

var beijingLocation = func() *time.Location {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}

	return location
}()

func BeijingLocation() *time.Location {
	return beijingLocation
}

func NowBeijing() time.Time {
	return time.Now().In(beijingLocation)
}

func ParseBeijing(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, errors.New("empty time value")
	}

	parsed, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed.In(beijingLocation), nil
	}

	parsed, err = time.ParseInLocation("2006-01-02T15:04", value, beijingLocation)
	if err != nil {
		return time.Time{}, err
	}

	return parsed.In(beijingLocation), nil
}

func MaxTime(left time.Time, right time.Time) time.Time {
	if left.After(right) {
		return left
	}

	return right
}

func DayPathParts(input time.Time) (string, string, string) {
	target := input.In(beijingLocation)
	return target.Format("2006"), target.Format("01"), target.Format("02")
}

func SameBeijingDay(left time.Time, right time.Time) bool {
	leftInTZ := left.In(beijingLocation)
	rightInTZ := right.In(beijingLocation)

	return leftInTZ.Format("2006-01-02") == rightInTZ.Format("2006-01-02")
}